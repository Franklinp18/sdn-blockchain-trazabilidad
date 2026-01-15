FROM nginx:1.27-alpine

# Copiamos config nginx (incluye proxy /api)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos tu frontend estático
COPY src/ /usr/share/nginx/html/

# Salud básica (opcional)
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

