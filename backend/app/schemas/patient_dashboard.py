from pydantic import BaseModel


class PatientDashboardAppointment(BaseModel):
    id: str
    doctor_name: str
    specialty: str | None = None
    appointment_date: str
    status: str
    reason: str | None = None


class PatientDashboardMedicationTrend(BaseModel):
    labels: list[str]
    values: list[int]
    adherence_rate: int
    delta_percent: float


class PatientDashboardHealthStat(BaseModel):
    label: str
    value: str
    trend: str
    trend_type: str


class PatientDashboardInsight(BaseModel):
    title: str
    description: str
    tone: str


class PatientDashboardDeviceStatus(BaseModel):
    title: str
    last_synced: str
    connected: bool


class PatientDashboardResponse(BaseModel):
    user_name: str
    health_score: int
    upcoming_appointments: list[PatientDashboardAppointment]
    medication_adherence_trend: PatientDashboardMedicationTrend
    today_health_stats: list[PatientDashboardHealthStat]
    ai_insights: list[PatientDashboardInsight]
    device_connection_status: PatientDashboardDeviceStatus
