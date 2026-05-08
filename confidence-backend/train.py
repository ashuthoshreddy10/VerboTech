import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

DB_PATH = "confidence.db"
MODEL_PATH = "confidence_model.joblib"

def train_model():
    print("Starting ML Model Training Pipeline...")

    # 1. Load Data from SQLite
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found. Ensure the backend has run and collected data.")
        return

    conn = sqlite3.connect(DB_PATH)
    
    # We select the features for X and the confidence_score for y
    query = """
    SELECT 
        duration, 
        silence_count, 
        silence_ratio, 
        eye_contact_score, 
        expressiveness_score, 
        confidence_score 
    FROM sessions
    WHERE confidence_score IS NOT NULL
    """
    
    df = pd.read_sql_query(query, conn)
    conn.close()

    if len(df) < 5:
        print(f"Warning: Only {len(df)} records found. We need more data to train a robust model.")
        print("Bootstrapping with synthetic data for demonstration purposes...")
        
        # Bootstrap synthetic data just so the model can train if there are no real sessions yet
        np.random.seed(42)
        syn_size = 100
        syn_dur = np.random.randint(30, 120, syn_size)
        syn_sil = np.random.randint(0, 10, syn_size)
        syn_ratio = syn_sil / syn_dur * 0.5
        syn_eye = np.random.choice([0.0, 0.5, 1.0], syn_size)
        syn_exp = np.random.choice([0.0, 0.5, 1.0], syn_size)
        
        # Synthetic formula matching our old heuristic
        syn_conf = 40 + (np.where(syn_sil == 0, 20, -syn_sil * 2)) + (syn_eye * 20) + (syn_exp * 20)
        syn_conf = np.clip(syn_conf, 0, 100)
        
        syn_df = pd.DataFrame({
            'duration': syn_dur,
            'silence_count': syn_sil,
            'silence_ratio': syn_ratio,
            'eye_contact_score': syn_eye,
            'expressiveness_score': syn_exp,
            'confidence_score': syn_conf
        })
        
        df = pd.concat([df, syn_df], ignore_index=True)

    print(f"Training on {len(df)} records...")

    # 2. Prepare Features (X) and Target (y)
    X = df[['duration', 'silence_count', 'silence_ratio', 'eye_contact_score', 'expressiveness_score']]
    y = df['confidence_score']

    # 3. Train-Test Split (80% training, 20% validation)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 4. Initialize and Train the Model
    # A Random Forest is great because it handles non-linear relationships well without complex scaling
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)

    # 5. Evaluate the Model
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    print(f"\nModel Evaluation:")
    print(f"- Mean Absolute Error: {mae:.2f} points")
    print(f"- R² Score: {r2:.2f} (1.0 is perfect prediction)")

    # 6. Save the Model
    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved successfully to {MODEL_PATH}")
    print("The FastAPI backend will automatically use this model on next restart.")

if __name__ == "__main__":
    train_model()
