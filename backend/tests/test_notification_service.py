import pytest
from backend.app.services.notification_service import send_emergency_sms, notification_service
from backend.app.config import settings

def test_send_emergency_sms_below_threshold():
    # Depths <= 30cm should NOT trigger SMS alert
    assert send_emergency_sms(depth=15.0, location="Main St") is False
    assert send_emergency_sms(depth=30.0, location="Main St") is False
    assert send_emergency_sms(depth=0.0, location="Main St") is False

def test_send_emergency_sms_above_threshold(monkeypatch):
    # Depths > 30cm should trigger emergency alert
    published_payloads = []

    class MockSNS:
        def publish(self, **kwargs):
            published_payloads.append(kwargs)
            return {"MessageId": "mock-msg-12345"}

    monkeypatch.setattr(notification_service, "sns", MockSNS())
    monkeypatch.setattr(notification_service, "phone_number", "+15550192834")

    res = send_emergency_sms(depth=38.5, location="Lat 19.0760, Lon 72.8777")
    assert res is True
    assert len(published_payloads) == 1
    msg = published_payloads[0]["Message"]
    assert "🚨 FLOOD ALERT: Severe waterlogging detected." in msg
    assert "Depth: 38.5cm at Lat 19.0760, Lon 72.8777." in msg
    assert "Immediate road closure recommended." in msg
    assert published_payloads[0]["PhoneNumber"] == "+15550192834"

def test_send_emergency_sms_fallback_when_sns_fails(monkeypatch):
    # When live SNS fails, graceful fallback should still report alert for demo
    class FailingSNS:
        def publish(self, **kwargs):
            raise Exception("AWS Sandbox Quota Exceeded")

    monkeypatch.setattr(notification_service, "sns", FailingSNS())
    res = send_emergency_sms(depth=42.0, location="Downtown Underpass")
    assert res is True
