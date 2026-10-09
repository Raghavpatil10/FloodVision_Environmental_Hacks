from backend.app.repositories.incident_repo import IncidentRepository
import pytest

def test_save_incident(mocker):
    mocker.patch('boto3.resource')
    repo = IncidentRepository()
    
    # Mock the table
    mock_table = mocker.MagicMock()
    repo.table = mock_table
    
    incident_data = {"latitude": 10.0, "longitude": 20.0, "safety_score": 50, "status": "active"}
    
    incident_id = repo.save_incident(incident_data)
    assert incident_id is not None
    mock_table.put_item.assert_called_once()
    
    call_args = mock_table.put_item.call_args[1]["Item"]
    assert call_args["latitude"] == 10.0
    assert call_args["incident_id"] == incident_id
    assert "reported_at" in call_args

def test_get_incident(mocker):
    mocker.patch('boto3.resource')
    repo = IncidentRepository()
    
    mock_table = mocker.MagicMock()
    mock_table.get_item.return_value = {"Item": {"incident_id": "123", "latitude": 10.0}}
    repo.table = mock_table
    
    item = repo.get_incident("123")
    assert item["latitude"] == 10.0
