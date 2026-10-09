#!/usr/bin/env bash
# Initializes LocalStack AWS resources for FloodVision

echo "Creating FloodVision S3 Bucket in LocalStack..."
awslocal s3 mb s3://floodvision-images

echo "Creating FloodVision DynamoDB Table in LocalStack..."
awslocal dynamodb create-table \
    --table-name floodvision_incidents \
    --attribute-definitions \
        AttributeName=incident_id,AttributeType=S \
    --key-schema \
        AttributeName=incident_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

echo "Creating FloodVision SNS Topic in LocalStack..."
awslocal sns create-topic --name floodvision_critical_alerts

echo "LocalStack AWS resources successfully provisioned!"
