FROM debian:13-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY ./script/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /dashboard
ARG TARGETOS=linux
ARG TARGETARCH=amd64
COPY dist/kulin-dashboard-${TARGETOS}-${TARGETARCH} ./app
COPY dist/kulin-migrate-${TARGETOS}-${TARGETARCH} ./kulin-migrate

VOLUME ["/dashboard/data"]
EXPOSE 8008
ARG TZ=Asia/Shanghai
ENV TZ=$TZ
ENTRYPOINT ["/entrypoint.sh"]
