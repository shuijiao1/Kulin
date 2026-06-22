FROM alpine AS depend
RUN apk add --update --no-cache ca-certificates tzdata

FROM busybox:stable-musl

ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG VCS_REF=unknown

COPY --from=depend /etc/ssl/certs /etc/ssl/certs
COPY --from=depend /usr/share/zoneinfo /usr/share/zoneinfo
COPY ./script/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /dashboard
COPY dist/dashboard-${TARGETOS}-${TARGETARCH} ./app

VOLUME ["/dashboard/data"]
EXPOSE 8008
ARG TZ=Asia/Shanghai
ENV TZ=$TZ
LABEL org.opencontainers.image.title="Kulin" \
      org.opencontainers.image.description="Kulin monitoring dashboard" \
      org.opencontainers.image.source="https://github.com/shuijiao1/Kulin" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$VCS_REF"
ENTRYPOINT ["/entrypoint.sh"]
