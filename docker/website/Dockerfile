FROM python:3.12-slim-bookworm AS runtime
ARG MOINPDF_UID=10001
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MOINPDF_CHROMIUM=/usr/bin/chromium
WORKDIR /service
COPY requirements.txt requirements.lock.txt ./
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.lock.txt \
    && useradd --uid ${MOINPDF_UID} --no-create-home moinpdf
COPY app.py network.py render.py ./
USER ${MOINPDF_UID}:${MOINPDF_UID}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log", "--limit-concurrency", "8"]

FROM runtime AS test
USER root
RUN pip install --no-cache-dir httpx==0.28.1 pymupdf==1.28.2
USER ${MOINPDF_UID}:${MOINPDF_UID}

FROM runtime AS production
