# Cotización de hosting anual — Sistema Repuestos Web

**Proyecto:** Aplicación web de gestión de repuestos (Next.js 16 + MySQL)  
**Fecha de cotización:** 7 de junio de 2026  
**Presupuesto máximo:** USD 80,00 / año  
**Volumen estimado de imágenes:** ~6.000 archivos de producto  

---

## 1. Resumen ejecutivo

| Concepto | Valor |
|----------|-------|
| **Opción recomendada** | VPS autogestionado (Hetzner CX23 + Coolify) |
| **Costo anual estimado** | **USD 64 – 68 / año** |
| **Margen bajo el tope** | ~USD 12 – 16 de ahorro vs. límite de USD 80 |
| **Capacidad de imágenes** | Hasta ~6.000 imágenes (~2–3 GB) con espacio de sobra |

La aplicación actual almacena imágenes en **Vercel Blob** (producción) o en disco local `public/uploads/productos/` (desarrollo). La base de datos MySQL guarda metadatos y URLs, no los archivos binarios.

---

## 2. Estimación de almacenamiento (6.000 imágenes)

Parámetros del sistema:

- Tamaño máximo por archivo permitido en código: **5 MB**
- Formatos admitidos: JPEG, PNG, WebP, GIF

| Escenario | Tamaño promedio por imagen | Almacenamiento total |
|-----------|---------------------------|----------------------|
| Optimizado (recomendado) | 150 – 200 KB | **0,9 – 1,2 GB** |
| Uso típico | 300 KB | **~1,8 GB** |
| Conservador | 500 KB | **~3,0 GB** |
| Peor caso (sin optimizar) | 1 MB | **~6,0 GB** |

**Conclusión:** Con imágenes razonablemente optimizadas, el volumen ronda **1,5 – 2 GB**. Todas las opciones cotizadas cubren este rango con margen.

---

## 3. Opciones de hosting (todas ≤ USD 80 / año)

### Opción A — Recomendada: VPS todo en uno

**Ideal para uso comercial, control total y menor dependencia de terceros.**

| Servicio | Proveedor | Especificaciones | Costo mensual | Costo anual |
|----------|-----------|------------------|---------------|-------------|
| Servidor VPS | Hetzner Cloud CX23 | 2 vCPU, 4 GB RAM, 40 GB NVMe, 20 TB tráfico | EUR 3,99 (~USD 4,30) | **~USD 52** |
| Dominio `.com` | Namecheap / Cloudflare / similar | 1 dominio | — | **~USD 12** |
| SSL | Let's Encrypt (vía Coolify) | Certificado automático | USD 0 | USD 0 |
| MySQL | En el mismo VPS | Instalado con Coolify/Docker | USD 0 | USD 0 |
| Imágenes | Disco del VPS (`public/uploads/`) | Hasta ~30 GB disponibles para media | USD 0 | USD 0 |
| Panel de despliegue | Coolify (open source) | Deploy desde Git, HTTPS, backups básicos | USD 0 | USD 0 |

| | |
|---|---|
| **Total anual estimado** | **USD 64 – 68** |
| **Ventajas** | Un solo proveedor, sin límite comercial, 40 GB almacenan cómodamente 6.000+ imágenes, el código ya soporta uploads en disco |
| **Consideraciones** | Requiere configuración inicial (~2–4 h). Backups manuales o script recomendado |

---

### Opción B — Mínimo costo: stack serverless gratuito

**Ideal para prototipo, uso personal o tráfico bajo.**

| Servicio | Proveedor | Incluido en plan gratuito | Costo anual |
|----------|-----------|---------------------------|-------------|
| Hosting Next.js | Vercel Hobby | Deploy automático, CDN, 100 GB transferencia/mes | USD 0 |
| Base de datos | Aiven MySQL Free | 1 vCPU, 1 GB RAM, 1 GB disco (solo metadatos) | USD 0 |
| Imágenes | Vercel Blob Hobby | 1 GB almacenamiento + 10 GB transferencia Blob/mes | USD 0* |
| Dominio | Registrador externo | — | **~USD 12** |

\* Si el total de imágenes supera 1 GB (~5.000+ fotos sin comprimir), el excedente cuesta **USD 0,023/GB/mes** → ~USD 0,55/año por cada GB extra.

| | |
|---|---|
| **Total anual estimado** | **USD 12 – 18** |
| **Ventajas** | Costo casi nulo, compatible con el código actual sin cambios |
| **Consideraciones** | Plan Vercel Hobby es **solo para uso personal/no comercial**. Aiven Free puede apagarse por inactividad. Límite de 1 GB en Blob si no se optimizan imágenes |

---

### Opción C — Serverless comercial: Vercel + Cloudflare R2

**Ideal si se quiere mantener Vercel pero con más espacio de imágenes sin pagar Blob.**

| Servicio | Proveedor | Detalle | Costo anual |
|----------|-----------|---------|-------------|
| Hosting Next.js | Vercel Hobby o Pro | Hobby USD 0; Pro USD 240/año (**excede presupuesto**) | USD 0 – 240 |
| Base de datos | Aiven MySQL Free | 1 GB disco | USD 0 |
| Imágenes | Cloudflare R2 | **10 GB gratis/mes**, egress gratis, 1M escrituras/mes | USD 0 |
| Dominio | Registrador externo | — | **~USD 12** |

| | |
|---|---|
| **Total anual (con Vercel Hobby)** | **~USD 12** |
| **Consideraciones** | Requiere **adaptar el código** de `@vercel/blob` a Cloudflare R2 (~2–4 h de desarrollo). R2 cubre holgadamente 6.000 imágenes (~2 GB) |

---

### Opción D — Vercel + Aiven pago (sin VPS)

**Si se necesita MySQL con más disco y uptime garantizado.**

| Servicio | Proveedor | Detalle | Costo anual |
|----------|-----------|---------|-------------|
| Hosting Next.js | Vercel Hobby | USD 0 | USD 0 |
| Base de datos | Aiven MySQL Developer | ~USD 5/mes, más RAM y disco | **~USD 60** |
| Imágenes | Vercel Blob | 1 GB incluido; excedente mínimo | **~USD 0 – 5** |
| Dominio | Registrador externo | — | **~USD 12** |

| | |
|---|---|
| **Total anual estimado** | **~USD 72 – 77** |
| **Ventajas** | MySQL gestionado 24/7, sin administrar servidor |
| **Consideraciones** | Ajustado al tope de USD 80. Menos margen para crecimiento de imágenes |

---

## 4. Opciones descartadas (superan USD 80 / año)

| Opción | Costo anual aprox. | Motivo de descarte |
|--------|-------------------|-------------------|
| Vercel Pro | USD 240 | USD 20/mes × 12, sin descuento anual |
| DigitalOcean Droplet + DB gestionada | USD 120+ | Droplet USD 48 + MySQL gestionado USD 180/año mínimo |
| Solo Vercel Blob sin optimizar (>3 GB) | Variable | Posible pero innecesario; hay alternativas más baratas |

---

## 5. Comparativa rápida

| Criterio | A — VPS | B — Serverless free | C — Vercel + R2 | D — Vercel + Aiven pago |
|----------|---------|---------------------|-----------------|-------------------------|
| Costo anual | **~USD 65** | **~USD 15** | **~USD 12** | **~USD 75** |
| Uso comercial | ✅ Sí | ⚠️ Limitado (Vercel Hobby) | ⚠️ Limitado | ⚠️ Limitado |
| 6.000 imágenes | ✅ 40 GB disco | ✅ Con optimización | ✅ 10 GB R2 gratis | ✅ Con optimización |
| Cambios en código | Mínimos | Ninguno | Moderados (R2) | Ninguno |
| Mantenimiento | Medio | Bajo | Bajo | Bajo |
| Backups BD | Manual | Incluidos (Aiven) | Incluidos (Aiven) | Incluidos (Aiven) |

---

## 6. Recomendación final

Para **entrega en producción comercial** con ~6.000 imágenes y presupuesto ≤ USD 80/año:

> **Contratar Hetzner Cloud CX23 (EUR 3,99/mes) + dominio (~USD 12/año) + Coolify para despliegue.**  
> **Costo total: ~USD 64 – 68 / año.**

Para **validación o uso interno** con el menor gasto posible:

> **Vercel Hobby + Aiven MySQL Free + Vercel Blob (optimizando imágenes a WebP/JPEG < 300 KB).**  
> **Costo total: ~USD 12 – 18 / año** (solo dominio de pago).

---

## 7. Supuestos y exclusiones

**Incluido en la cotización:**

- Hosting de la aplicación web
- Base de datos MySQL
- Almacenamiento de ~6.000 imágenes de producto
- Certificado SSL
- Ancho de banda para tráfico moderado (decenas de usuarios concurrentes)

**No incluido:**

- Desarrollo, migración de datos o cambios de código
- Correo corporativo (ej. Google Workspace, ~USD 72/usuario/año)
- Backups externos automatizados (recomendado: +USD 0 – 20/año con Backblaze B2 o similar)
- IVA / impuestos locales según país del facturador
- Soporte técnico prioritario de proveedores

---

## 8. Fuentes de precios (junio 2026)

| Proveedor | Referencia |
|-----------|------------|
| Hetzner Cloud | https://www.hetzner.com/cloud — plan CX23 desde EUR 3,99/mes |
| Vercel | https://vercel.com/pricing — Hobby gratis; Blob USD 0,023/GB/mes |
| Aiven MySQL | https://aiven.io/pricing — Free USD 0; Developer desde ~USD 5/mes |
| Cloudflare R2 | https://developers.cloudflare.com/r2/pricing — 10 GB/mes gratis |
| Dominios | Precio de mercado ~USD 10 – 15/año para `.com` |

*Los precios están expresados en dólares estadounidenses (USD) salvo Hetzner (EUR). Tipo de cambio de referencia: 1 EUR ≈ 1,08 USD. Sujetos a cambio por parte de los proveedores.*

---

**Documento preparado para:** Sistema de gestión de repuestos — Repuestos Web  
**Validez de la cotización:** 30 días desde la fecha de emisión
