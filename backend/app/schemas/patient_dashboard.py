from pydantic import BaseModel


class PatientDashboardAppointment(BaseModel):
    id: str
    doctor_name: str
    specialty: str | None = None
    appointment_date: str
    status: str
    reason: str | None = None
    doctor_photo_url: str | None = None


class PatientDashboardHealthStat(BaseModel):
    label: str
    value: str


class PatientDashboardDeviceStatus(BaseModel):
    title: str
    last_synced: str
    connected: bool


class PatientDashboardCoverageGroup(BaseModel):
    key: str
    recorded: bool


class PatientDashboardRecordCoverage(BaseModel):
    recorded_groups: int
    total_groups: int
    coverage_percent: int
    groups: list[PatientDashboardCoverageGroup]
    window_start_utc: str
    window_end_utc: str
    as_of_utc: str


class PatientDashboardResponse(BaseModel):
    user_name: str
    record_coverage: PatientDashboardRecordCoverage | None = None
    upcoming_appointments: list[PatientDashboardAppointment]
    today_health_stats: list[PatientDashboardHealthStat]
    device_connection_status: PatientDashboardDeviceStatus
