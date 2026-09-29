# A native PostgreSQL cluster avoids requiring Docker-in-Docker in Code Ocean.
FROM postgres:16-bookworm@sha256:efedf3595f1d6f415c08568ba171029bf54052e754cc9f030e3f2412b21f3d67
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip ca-certificates libgl1 libglib2.0-0 \
    && python3 -m venv /opt/medora-python
ENV PATH="/opt/medora-python/bin:/usr/lib/postgresql/16/bin:${PATH}"
WORKDIR /code
ENTRYPOINT []
CMD ["bash", "/code/run"]
