FROM python:3.12-slim-bookworm AS runtime
ARG MOINPDF_UID=10001
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MOINPDF_TOOLS=/opt/moinpdf-tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless libreoffice-writer libreoffice-calc libreoffice-impress \
    ghostscript tesseract-ocr tesseract-ocr-osd fonts-dejavu fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /service
COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY install_tools.py tools.lock.json ./
RUN python install_tools.py && useradd --uid ${MOINPDF_UID} --no-create-home moinpdf
COPY app.py convert_documents.py extended_documents.py init_secret.py ./
USER ${MOINPDF_UID}:${MOINPDF_UID}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log", "--limit-concurrency", "8"]

# Used by the Docker integration workflow; test dependencies stay out of runtime.
FROM runtime AS test
USER root
RUN pip install --no-cache-dir httpx==0.28.1
USER ${MOINPDF_UID}:${MOINPDF_UID}

FROM runtime AS production
