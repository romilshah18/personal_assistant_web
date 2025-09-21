#!/bin/bash

# Create a simple 192x192 PNG icon using ImageMagick or convert if available
if command -v convert &> /dev/null; then
    echo "Creating icons with ImageMagick..."
    convert -size 192x192 xc:'#4A90E2' -fill white -gravity center -pointsize 80 -annotate +0+0 '🎤' icon-192x192.png
    convert -size 512x512 xc:'#4A90E2' -fill white -gravity center -pointsize 200 -annotate +0+0 '🎤' icon-512x512.png
else
    echo "ImageMagick not found, creating placeholder icons..."
    # Create simple colored squares as fallback
    python3 -c "
from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    img = Image.new('RGB', (size, size), '#4A90E2')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple circle
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], fill='white')
    
    # Draw microphone shape
    mic_width = size // 6
    mic_height = size // 3
    mic_x = (size - mic_width) // 2
    mic_y = (size - mic_height) // 2 - size // 12
    
    draw.rectangle([mic_x, mic_y, mic_x + mic_width, mic_y + mic_height], fill='#4A90E2')
    
    # Draw base
    base_width = size // 4
    base_x = (size - base_width) // 2
    base_y = mic_y + mic_height + size // 20
    draw.rectangle([base_x, base_y, base_x + base_width, base_y + size // 40], fill='#4A90E2')
    
    # Draw stand
    stand_x = size // 2 - 2
    draw.rectangle([stand_x, mic_y + mic_height, stand_x + 4, base_y], fill='#4A90E2')
    
    img.save(filename)
    print(f'Created {filename}')

create_icon(192, 'icon-192x192.png')
create_icon(512, 'icon-512x512.png')
"
fi
