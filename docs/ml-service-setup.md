# ML Service Integration Guide

## Overview
ElSawa7 uses an ML service to verify Vodafone Cash payment screenshots. This document provides specifications for integrating an external ML service.

## Current Implementation

### Mock ML Service
The `mock-ml-verify` edge function simulates ML responses for testing:
- Located at: `supabase/functions/mock-ml-verify/index.ts`
- Returns random confidence scores (0.6-1.0)
- Simulates OCR text extraction

### Production ML Service
For production, deploy a dedicated ML service with the following specifications:

## API Contract

### Endpoint
```
POST /ml/verify
Content-Type: application/json
```

### Request Body
```json
{
  "image_url": "https://...",
  // OR
  "image_base64": "base64_encoded_image_data"
}
```

### Response
```json
{
  "is_vodafone_cash": true,
  "confidence": 0.85,
  "ocr_text": "Vodafone Cash\nتم التحويل بنجاح\nرقم العملية: VC1234567890\nالمبلغ: 50 ج.م",
  "extracted_fields": {
    "transaction_id": "VC1234567890",
    "amount": 50,
    "from_phone": "01012345678",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Confidence Thresholds
- `>= 0.75`: Auto-create temporary reservation
- `< 0.75`: Flag as `low_confidence`, route to admin review

## ML Service Implementation

### Technology Stack
```
- Framework: FastAPI (Python)
- ML Framework: PyTorch or TensorFlow
- OCR: Tesseract / EasyOCR
- Deployment: Docker + Kubernetes
```

### Example Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-ara \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Example requirements.txt
```
fastapi==0.109.0
uvicorn==0.27.0
python-multipart==0.0.6
pillow==10.2.0
pytesseract==0.3.10
torch==2.1.2
torchvision==0.16.2
transformers==4.36.2
numpy==1.26.3
httpx==0.26.0
```

### Example FastAPI Implementation
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
import io
import pytesseract
from PIL import Image
import torch
# Import your trained classifier

app = FastAPI()

class VerifyRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None

class ExtractedFields(BaseModel):
    transaction_id: Optional[str] = None
    amount: Optional[float] = None
    from_phone: Optional[str] = None
    timestamp: Optional[str] = None

class VerifyResponse(BaseModel):
    is_vodafone_cash: bool
    confidence: float
    ocr_text: str
    extracted_fields: ExtractedFields

# Load your trained model
# model = load_model("vodafone_cash_classifier.pt")

@app.post("/ml/verify", response_model=VerifyResponse)
async def verify_payment(request: VerifyRequest):
    if not request.image_url and not request.image_base64:
        raise HTTPException(status_code=400, detail="Missing image")
    
    # Load image
    if request.image_base64:
        image_data = base64.b64decode(request.image_base64)
        image = Image.open(io.BytesIO(image_data))
    else:
        # Fetch from URL
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(request.image_url)
            image = Image.open(io.BytesIO(response.content))
    
    # Run classification
    # confidence = model.predict(image)
    confidence = 0.85  # Placeholder
    
    # Run OCR
    ocr_text = pytesseract.image_to_string(image, lang='ara+eng')
    
    # Extract fields from OCR text
    extracted_fields = extract_fields(ocr_text)
    
    return VerifyResponse(
        is_vodafone_cash=confidence >= 0.75,
        confidence=confidence,
        ocr_text=ocr_text,
        extracted_fields=extracted_fields
    )

def extract_fields(ocr_text: str) -> ExtractedFields:
    # Parse OCR text to extract transaction details
    # Implement regex patterns for Vodafone Cash receipts
    import re
    
    transaction_id = None
    amount = None
    from_phone = None
    
    # Example patterns (adjust based on actual receipt format)
    tx_match = re.search(r'(VC\d{10,})', ocr_text)
    if tx_match:
        transaction_id = tx_match.group(1)
    
    amount_match = re.search(r'(\d+(?:\.\d{2})?)\s*(?:ج\.م|EGP)', ocr_text)
    if amount_match:
        amount = float(amount_match.group(1))
    
    phone_match = re.search(r'(01[0-9]{9})', ocr_text)
    if phone_match:
        from_phone = phone_match.group(1)
    
    return ExtractedFields(
        transaction_id=transaction_id,
        amount=amount,
        from_phone=from_phone,
        timestamp=None
    )
```

## Integration with ElSawa7

### Update verify-payment Edge Function
Replace the Lovable AI call with your ML service:

```typescript
// In supabase/functions/verify-payment/index.ts

const ML_SERVICE_URL = Deno.env.get('ML_SERVICE_URL');

const mlResponse = await fetch(`${ML_SERVICE_URL}/ml/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image_base64: imageBase64 })
});

const result = await mlResponse.json();
```

### Add Secret
```bash
# Add ML_SERVICE_URL to Supabase secrets
# Via Lovable: Use the secrets management tool
```

## Deployment Options

### Option 1: Cloud Run (GCP)
```bash
gcloud run deploy ml-verify \
  --image gcr.io/your-project/ml-verify \
  --platform managed \
  --memory 2Gi \
  --cpu 2
```

### Option 2: AWS ECS/Fargate
```yaml
# task-definition.json
{
  "family": "ml-verify",
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [{
    "name": "ml-verify",
    "image": "your-ecr-repo/ml-verify:latest",
    "portMappings": [{"containerPort": 8000}]
  }]
}
```

### Option 3: Self-Hosted Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-verify
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: ml-verify
        image: your-registry/ml-verify:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        ports:
        - containerPort: 8000
```

## Training Data Requirements

To train the Vodafone Cash classifier:
1. Collect 500+ positive samples (real VC receipts)
2. Collect 500+ negative samples (other screenshots, random images)
3. Label dataset
4. Fine-tune a vision model (ResNet, EfficientNet, or ViT)
5. Export for inference

## Monitoring

Track these metrics:
- Classification accuracy
- OCR extraction rate
- Response latency
- False positive/negative rates

Set alerts for:
- Confidence score distribution shifts
- High error rates
- Latency spikes
