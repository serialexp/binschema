FROM node:20-alpine AS build

WORKDIR /workspace/website

# Install dependencies first to leverage Docker layer caching
COPY website/package.json ./

# Copy workspace packages needed for the binschema dependency
COPY packages/binschema/package.json ../packages/binschema/package.json
COPY packages/binschema/dist/ ../packages/binschema/dist/
COPY packages/zod-metadata-extractor/package.json ../packages/zod-metadata-extractor/package.json
COPY packages/zod-metadata-extractor/dist/ ../packages/zod-metadata-extractor/dist/

RUN npm install --no-fund --no-audit

# Copy website application source
COPY website/ ./

# Copy repo assets needed by prepare-docs.js (generates HTML docs from example schemas)
COPY README.md ../README.md
COPY examples/ ../examples/

# Build the static site (prepare-docs generates HTML docs, then Vite builds)
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/website/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
