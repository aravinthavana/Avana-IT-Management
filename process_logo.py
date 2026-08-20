from PIL import Image
import glob

def process_logo(filepath):
    try:
        img = Image.open(filepath).convert('RGBA')
        
        # Get bounding box of non-transparent pixels
        bbox = img.getbbox()
        if not bbox:
            print(f"Image {filepath} is completely transparent.")
            return
            
        print(f"Original bounding box for {filepath}: {bbox}")
        
        # Crop the image to its bounding box
        cropped = img.crop(bbox)
        orig_w, orig_h = cropped.size
        print(f"Cropped size: {orig_w}x{orig_h}")
        
        # Target width is 85% of 2048 = 1740
        target_canvas = 2048
        target_width = 1740
        scale = target_width / orig_w
        target_height = int(orig_h * scale)
        
        print(f"Scaling to {target_width}x{target_height}")
        
        # Resize uniformly
        try:
            resample_filter = Image.Resampling.LANCZOS
        except AttributeError:
            resample_filter = Image.LANCZOS
            
        resized = cropped.resize((target_width, target_height), resample_filter)
        
        # Create new 2048x2048 transparent canvas
        new_img = Image.new('RGBA', (target_canvas, target_canvas), (0, 0, 0, 0))
        
        # Calculate paste position for exact center
        paste_x = (target_canvas - target_width) // 2
        paste_y = (target_canvas - target_height) // 2
        
        # Paste using the image itself as a mask to preserve transparency
        new_img.paste(resized, (paste_x, paste_y), resized)
        
        # Save over original
        new_img.save(filepath, format='PNG')
        print(f"Successfully processed {filepath}")
        
    except Exception as e:
        print(f"Error processing {filepath}: {str(e)}")

for f in glob.glob('frontend/public/logo*.png'):
    process_logo(f)
