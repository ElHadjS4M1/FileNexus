# Puesta en marcha

## 1. Requisitos previos

- Node.js 20 o superior (incluye npm)
- PostgreSQL 14 o superior accesible como `postgresql://user:pass@localhost:5433/protectinfo`
- OpenSSL (para generar las claves si aún no existen)

⚠️ Importa el certificado `server/config/dev-tls.crt` en el sistema o navegador para evitar avisos HTTPS durante el desarrollo.

## 2. Preparar el backend

```bash
# Instala todas las dependencias del monorepo
npm install

# Sitúate en el workspace del servidor
cd server

# Rellena server/.env (puedes copiar desde .env.example)

# Genera Prisma Client
npm run prisma:generate

# Ejecuta migraciones
npm run prisma:migrate

# Inserta datos iniciales (crea los usuarios admin, dept-head, project-head y user-standart todos con la contraseña ChangeMe123!)
npm run prisma:seed
```

Si aún no tienes claves:

```bash
openssl genrsa -out config/jwtRS256.key 3072
openssl rsa -in config/jwtRS256.key -pubout -out config/jwtRS256.key.pub

openssl req -x509 -newkey rsa:3072 -nodes \
  -keyout config/dev-tls.key \
  -out config/dev-tls.crt \
  -days 365 -subj "/CN=localhost"
```

## 3. Configurar el frontend client

```bash
cd ../client

# Copia .env.development.local o crea uno nuevo con:
# VITE_API_BASE=https://localhost:4000
# VITE_USE_HTTPS=true
# VITE_SSL_CRT_FILE=../server/config/dev-tls.crt
# VITE_SSL_KEY_FILE=../server/config/dev-tls.key
```

## 4. Arrancar todo en modo desarrollo

```bash
cd ..
npm run dev
```

Esto levanta:
- Backend en `https://localhost:4000`
- Frontend (client) en `https://localhost:5173`

## 5. Primer inicio de sesión

1. Entra como `admin / ChangeMe123!`.
2. El sistema solicitará cambiar la contraseña y generará las claves.
3. El sistema te pedirá configurar el TOTP.
4. Tras completar el primer acceso, podrás subir y descargar documentos cifrados.

## 6. Comandos útiles

```bash
# Solo backend (hot reload)
npm --workspace server run dev

# Solo frontend client
npm --workspace client run dev

# Build producción de client
npm --workspace client run build
```
