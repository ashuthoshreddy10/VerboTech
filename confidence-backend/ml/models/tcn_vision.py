import torch
import torch.nn as nn

class TemporalConvNet(nn.Module):
    """
    Temporal Convolutional Network for processing a sequence of MediaPipe facial landmarks.
    Expected Input: (Batch, sequence_length, num_features)
    """
    def __init__(self, num_features=52, hidden_channels=128, out_channels=256):
        super().__init__()
        # We need to reshape the input for Conv1d which expects (Batch, Channels, Time)
        self.conv1 = nn.Conv1d(
            in_channels=num_features, 
            out_channels=hidden_channels, 
            kernel_size=3, 
            padding=1
        )
        self.relu = nn.ReLU()
        self.pool = nn.MaxPool1d(2)
        
        self.conv2 = nn.Conv1d(
            in_channels=hidden_channels, 
            out_channels=out_channels, 
            kernel_size=3, 
            padding=1
        )
        # Global Average Pooling across the temporal dimension
        self.global_pool = nn.AdaptiveAvgPool1d(1)

    def forward(self, x):
        # x shape: (B, T, F) -> Transpose to (B, F, T) for Conv1D
        x = x.transpose(1, 2)
        
        # Pass 1
        x = self.conv1(x)
        x = self.relu(x)
        x = self.pool(x)
        
        # Pass 2
        x = self.conv2(x)
        x = self.relu(x)
        
        # Global Pooling
        x = self.global_pool(x) # (B, out_channels, 1)
        x = x.squeeze(-1)       # (B, out_channels)
        
        return x
