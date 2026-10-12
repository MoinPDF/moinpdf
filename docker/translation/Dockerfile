FROM libretranslate/libretranslate:v1.9.6
ARG MOINPDF_UID=1032
ENV ARGOS_CHUNK_TYPE=MINISBD PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER root
RUN mkdir -p /home/libretranslate/.cache \
    && chown -R ${MOINPDF_UID}:${MOINPDF_UID} /home/libretranslate \
    && chown ${MOINPDF_UID}:${MOINPDF_UID} /app
COPY ensure_models.py healthcheck.py /opt/moinpdf/
COPY --chmod=755 start-translation.sh /opt/moinpdf/
USER ${MOINPDF_UID}:${MOINPDF_UID}
