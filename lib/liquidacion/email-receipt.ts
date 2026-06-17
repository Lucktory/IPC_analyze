// ============================================================================
// Premium HTML receipt for the per-row "Liquidar y enviar mail" flow.
//
// Pure functions (no 'use server' directive) so the helpers can be imported
// from both server actions (drafting) and client components (clipboard
// "Copiar HTML" button in the modal preview).
//
// Email-client safe: table-based layout, inline styles, web-safe font stacks,
// width/bgcolor as both HTML attributes and inline CSS. No flexbox/grid,
// no media queries, no <style> blocks. Outlook 2007+ renders cleanly.
//
// Premium aesthetic notes:
//   • Cream paper background instead of stark white → warmer brand feel
//   • Georgia serif for agency name + amounts → editorial, not corporate
//   • Single gold (#D4A857) hairline under the header → restrained accent
//   • Section labels in muted emerald / amber tracked uppercase → receipt code
//   • SALDO A RENDIR rendered as a tinted block w/ emerald rule → the punchline
// ============================================================================

import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'

// Hardcoded today — single agency. If multi-tenant arrives, swap these for
// a query against the `administrations` row tied to the period's contract.
const AGENCY = {
  name:    'Patagonia Propiedades',
  address: 'Mitre 674 · Comodoro Rivadavia, Chubut',
  phone:   '(0297) 444-4862',
  email:   'patagoniainmo@gmail.com',
} as const

export interface ReceiptInput {
  landlordName:  string
  tenantName:    string
  /** YYYY-MM */
  period:        string
  gross:         number
  commission:    number
  otros:         number
  netToLandlord: number
  /** Encargada's email for the signature line; may be null. */
  senderEmail:   string | null
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildReceiptHtml(input: ReceiptInput): string {
  const period           = periodLabel(input.period)
  const totalDeducciones = input.commission + input.otros
  const firstWord        = AGENCY.name.split(' ')[0]
  const restWords        = AGENCY.name.split(' ').slice(1).join(' ')

  const otrosRow = input.otros > 0
    ? `<tr>
         <td style="padding:6px 0;font:13px/1.4 Helvetica,Arial,sans-serif;color:#555555;">Otros descuentos</td>
         <td align="right" style="padding:6px 0;font:13px/1.4 Georgia,'Times New Roman',serif;color:#1A1A1A;">- ${esc(fmtMoney(input.otros))}</td>
       </tr>`
    : ''

  const sigEmailRow = input.senderEmail?.trim()
    ? `<div style="font:11px/1.6 Helvetica,Arial,sans-serif;color:#7E8696;margin-top:2px;">${esc(input.senderEmail.trim())}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(AGENCY.name)} — Recibo de liquidación</title>
</head>
<body style="margin:0;padding:0;background:#F5F1E8;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F1E8" style="background:#F5F1E8;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFDF8" style="background:#FFFDF8;border:1px solid #ECE5D0;border-radius:4px;">

        <tr>
          <td style="padding:32px 36px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="font:600 19px/1.2 Georgia,'Times New Roman',serif;color:#1A1A1A;letter-spacing:0.3px;">
                  ${esc(firstWord)}<span style="color:#D4A857;">&nbsp;·&nbsp;</span><span style="font-weight:400;">${esc(restWords)}</span>
                </td>
                <td valign="middle" align="right" style="font:600 9px/1 Helvetica,Arial,sans-serif;color:#7E8696;letter-spacing:2px;text-transform:uppercase;">
                  Recibo de liquidación
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td height="1" bgcolor="#D4A857" style="line-height:1px;font-size:0;background:#D4A857;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 36px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="padding:6px 0;font:600 9px/1.2 Helvetica,Arial,sans-serif;color:#7E8696;letter-spacing:1.5px;text-transform:uppercase;">Propietario</td>
                <td width="50%" style="padding:6px 0;font:600 9px/1.2 Helvetica,Arial,sans-serif;color:#7E8696;letter-spacing:1.5px;text-transform:uppercase;">Período</td>
              </tr>
              <tr>
                <td style="padding:0 0 14px;font:600 14px/1.3 Helvetica,Arial,sans-serif;color:#1A1A1A;">${esc(input.landlordName)}</td>
                <td style="padding:0 0 14px;font:600 14px/1.3 Helvetica,Arial,sans-serif;color:#1A1A1A;">${esc(period)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font:600 9px/1.2 Helvetica,Arial,sans-serif;color:#7E8696;letter-spacing:1.5px;text-transform:uppercase;">Inquilino</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:0 0 6px;font:13px/1.3 Helvetica,Arial,sans-serif;color:#555555;">${esc(input.tenantName)}</td>
                <td>&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 36px 4px;">
            <div style="font:600 10px/1 Helvetica,Arial,sans-serif;color:#3F8C5A;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #ECE5D0;">Ingresos</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
              <tr>
                <td style="padding:6px 0;font:13px/1.4 Helvetica,Arial,sans-serif;color:#555555;">Total cobrado en el período</td>
                <td align="right" style="padding:6px 0;font:13px/1.4 Georgia,'Times New Roman',serif;color:#1A1A1A;">${esc(fmtMoney(input.gross))}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 36px 4px;">
            <div style="font:600 10px/1 Helvetica,Arial,sans-serif;color:#B8702B;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #ECE5D0;">Deducciones</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
              <tr>
                <td style="padding:6px 0;font:13px/1.4 Helvetica,Arial,sans-serif;color:#555555;">Comisión de administración</td>
                <td align="right" style="padding:6px 0;font:13px/1.4 Georgia,'Times New Roman',serif;color:#1A1A1A;">- ${esc(fmtMoney(input.commission))}</td>
              </tr>
              ${otrosRow}
              <tr>
                <td style="padding:8px 0 0;border-top:1px solid #F4EFE0;font:600 10px/1.2 Helvetica,Arial,sans-serif;color:#7E8696;letter-spacing:1px;text-transform:uppercase;">Total deducciones</td>
                <td align="right" style="padding:8px 0 0;border-top:1px solid #F4EFE0;font:13px/1.2 Georgia,'Times New Roman',serif;color:#555555;">- ${esc(fmtMoney(totalDeducciones))}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 36px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F1F7F2" style="background:#F1F7F2;border-left:3px solid #6FB783;">
              <tr>
                <td valign="middle" style="padding:18px 20px;">
                  <div style="font:600 9px/1 Helvetica,Arial,sans-serif;color:#2A6A45;letter-spacing:2px;text-transform:uppercase;">Saldo a rendir</div>
                  <div style="font:11px/1.4 Helvetica,Arial,sans-serif;color:#7E8696;margin-top:4px;">Se acreditará en su cuenta en las próximas horas</div>
                </td>
                <td valign="middle" align="right" style="padding:18px 20px;font:600 24px/1 Georgia,'Times New Roman',serif;color:#1A1A1A;">${esc(fmtMoney(input.netToLandlord))}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 36px 0;font:13px/1.6 Helvetica,Arial,sans-serif;color:#555555;">
            Estimado/a ${esc(input.landlordName)}, le adjuntamos el detalle de la liquidación correspondiente al período <strong style="color:#1A1A1A;">${esc(period)}</strong>, contrato con ${esc(input.tenantName)}.
            <br><br>
            Cualquier consulta, quedamos a disposición.
          </td>
        </tr>

        <tr>
          <td style="padding:22px 36px 28px;font:13px/1.5 Helvetica,Arial,sans-serif;color:#1A1A1A;">
            Saludos cordiales,<br>
            <strong>${esc(AGENCY.name)}</strong>
            ${sigEmailRow}
          </td>
        </tr>

        <tr>
          <td style="padding:18px 36px 32px;border-top:1px solid #ECE5D0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font:10px/1.6 Helvetica,Arial,sans-serif;color:#7E8696;">
                  ${esc(AGENCY.address)}
                </td>
                <td align="right" style="font:10px/1.6 Helvetica,Arial,sans-serif;color:#7E8696;">
                  ${esc(AGENCY.phone)}&nbsp;&nbsp;·&nbsp;&nbsp;${esc(AGENCY.email)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function buildReceiptText(input: ReceiptInput): string {
  const period = periodLabel(input.period)
  const lines: string[] = []
  lines.push(`Estimado/a ${input.landlordName},`)
  lines.push('')
  lines.push(`Le adjuntamos el detalle de la liquidación correspondiente al período ${period}, contrato con ${input.tenantName}:`)
  lines.push('')
  lines.push(`  • Total cobrado:        ${fmtMoney(input.gross)}`)
  lines.push(`  • Comisión de admin.:   ${fmtMoney(input.commission)}`)
  if (input.otros > 0) lines.push(`  • Otros descuentos:     ${fmtMoney(input.otros)}`)
  lines.push(`  • Saldo a rendir:       ${fmtMoney(input.netToLandlord)}`)
  lines.push('')
  lines.push('Se acreditará en su cuenta en las próximas horas. Cualquier consulta, quedamos a disposición.')
  lines.push('')
  lines.push('Saludos cordiales,')
  lines.push(AGENCY.name)
  if (input.senderEmail?.trim()) lines.push(input.senderEmail.trim())
  return lines.join('\n')
}
