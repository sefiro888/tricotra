# TRICOTRA checkout seguro

Esta version usa Stripe Elements para que los datos de tarjeta no pasen por el servidor de TRICOTRA. El servidor solo crea el PaymentIntent y valida precios, cantidades y datos basicos.

## Configuracion local

1. Crea una cuenta en Stripe y copia las claves de modo test.
2. Arranca el servidor con variables de entorno:

```powershell
$env:STRIPE_PUBLISHABLE_KEY="pk_test_..."
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_WEBHOOK_SECRET="whsec_..."
$env:PORT="8080"
node dev-server.js
```

3. Abre `http://localhost:8080`.

## Produccion

- Usar siempre HTTPS.
- Guardar `STRIPE_SECRET_KEY` solo en el servidor, nunca en `index.html` ni `script.js`.
- Activar webhooks de Stripe para confirmar pedidos pagados aunque el cliente cierre el navegador.
- Configurar el webhook de Stripe apuntando a `/api/stripe-webhook`.
- Mover pedidos a una base de datos real.
- Revisar politicas legales: privacidad, cookies, devoluciones, envios y aviso legal.
