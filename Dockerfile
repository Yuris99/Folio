FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4173 \
    FOLIO_DATA_DIR=/data

COPY --chown=node:node package.json ./
COPY --chown=node:node index.html styles.css config.js api.js app.js server.js ./
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/folio-entrypoint

RUN apk add --no-cache su-exec \
    && chmod 755 /usr/local/bin/folio-entrypoint \
    && mkdir -p /data \
    && chown node:node /data

USER root

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["folio-entrypoint"]
CMD ["node", "server.js"]
