# Medora Observability Bundle

This folder contains production-style observability configuration for Medora testing and benchmarking:

- `prometheus.yml`: scrape configuration for backend, AI OCR, frontend vitals endpoint, and postgres exporter
- `grafana/provisioning/*`: auto-provision datasource + dashboards
- `grafana/dashboards/*`: dashboard definitions

## Dashboards

- `system-health-overview.json`: global request rate, p95 latency, and 5xx ratio
- `ai-performance-dashboard.json`: AI provider latency, OCR pipeline latency, AI outcome rates
- `appointment-load-dashboard.json`: appointment request volume and high-percentile latency
- `error-heatmap-dashboard.json`: per-path error concentration

## Usage

Mount these files into your Prometheus/Grafana containers:

- Prometheus config target: `/etc/prometheus/prometheus.yml`
- Grafana dashboards target: `/var/lib/grafana/dashboards`
- Grafana provisioning target: `/etc/grafana/provisioning`
