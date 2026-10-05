FROM libretranslate/libretranslate:v1.8.4
ENV ARGOS_CHUNK_TYPE=MINISBD PYTHONUNBUFFERED=1
RUN mkdir -p /home/libretranslate/.cache
COPY ensure_models.py healthcheck.py /opt/moinpdf/
