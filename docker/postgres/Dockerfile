# 개발·CI·운영에서 같은 이미지를 쓴다. PGroonga와 pgvector를 함께 담은 공식
# 이미지가 없어 공식 postgres 이미지에 두 확장을 apt로 올린다.
#
# postgres 공식 이미지는 PGDG 저장소에서 설치되므로 pgvector는 PGDG 패키지를,
# PGroonga는 Groonga apt 저장소의 pgdg 변종을 쓴다.
FROM postgres:18.1-trixie

ARG PGROONGA_PACKAGE=postgresql-18-pgdg-pgroonga
ARG PGVECTOR_PACKAGE=postgresql-18-pgvector

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl lsb-release; \
    codename="$(lsb_release --codename --short)"; \
    curl -fsSL -o /tmp/groonga-apt-source.deb \
      "https://packages.groonga.org/debian/groonga-apt-source-latest-${codename}.deb"; \
    apt-get install -y -V /tmp/groonga-apt-source.deb; \
    apt-get update; \
    apt-get install -y --no-install-recommends "$PGROONGA_PACKAGE" "$PGVECTOR_PACKAGE"; \
    rm -f /tmp/groonga-apt-source.deb; \
    apt-get purge -y --auto-remove curl lsb-release; \
    rm -rf /var/lib/apt/lists/*
