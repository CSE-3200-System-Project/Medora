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
    icon: str | None = None


class PatientDashboardDeviceStatus(BaseModel):
    title: str
    last_synced: str
    connected: bool


class PatientDashboardScoreFactor(BaseModel):
    label: str
    points: int
    max_points: int
    status: str  # "good" | "warning" | "missing"
    detail: str


class PatientDashboardScoreBreakdown(BaseModel):
    total: int
    max_total: int
    factors: list[PatientDashboardScoreFactor]
    summary: str


class PatientDashboardBMI(BaseModel):
    value: float | None = None
    category: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None


class PatientDashboardResponse(BaseModel):
    user_name: str
    health_score: int
    score_breakdown: PatientDashboardScoreBreakdown | None = None
    bmi: PatientDashboardBMI | None = None
    chronic_conditions_count: int = 0
    chronic_conditions: list[str] = []
    active_medications_count: int = 0
    upcoming_appointments: list[PatientDashboardAppointment]
    medication_adherence_trend: PatientDashboardMedicationTrend
    today_health_stats: list[PatientDashboardHealthStat]
    ai_insights: list[PatientDashboardInsight]
    device_connection_status: PatientDashboardDeviceStatus
