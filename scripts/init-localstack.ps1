# Initializes LocalStack AWS resources for FloodVision on Windows

$endpoint = "http://localhost:4566"

Write-Host "Creating FloodVision S3 Bucket in LocalStack..."
aws --endpoint-url=$endpoint s3 mb s3://floodvision-images

Write-Host "Creating FloodVision DynamoDB Table in LocalStack..."
aws --endpoint-url=$endpoint dynamodb create-table `
    --table-name floodvision_incidents `
    --attribute-definitions AttributeName=incident_id,AttributeType=S `
    --key-schema AttributeName=incident_id,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST

Write-Host "Creating FloodVision SNS Topic in LocalStack..."
aws --endpoint-url=$endpoint sns create-topic --name floodvision_critical_alerts

Write-Host "LocalStack AWS resources successfully provisioned!"
