import { pb, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import {
  $, aFecha, aIsoServidor, avatar, cargando, datosFormulario, dinero, entero, escapar, fecha, placa, retrasar,
  segmentos, vacio, valorFechaLocal,
} from "../ui.js"

let periodo = { desde: null, hasta: null }

const rango = (tipo) => {
  const hoy = new Date()
  const dia = (a, m, d) => new Date(a, m, d)
  switch (tipo) {
    case "hoy": return [dia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), hoy]
    case "semana": return [dia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6), hoy]
    case "anterior": return [dia(hoy.getFullYear(), hoy.getMonth() - 1, 1), dia(hoy.getFullYear(), hoy.getMonth(), 0)]
    default: return [dia(hoy.getFullYear(), hoy.getMonth(), 1), hoy]
  }
}

const establecer = (desde, hasta) => {
  periodo = {
    desde: new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0),
    hasta: new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59, 999),
  }
  $("#periodo-texto").textContent = `Del ${fecha(periodo.desde)} al ${fecha(periodo.hasta)}`
}

const claveDia = (f) => valorFechaLocal(f)

const grafico = (dias) => {
  const ancho = 720
  const alto = 220
  const margen = { arriba: 12, abajo: 26, izquierda: 44, derecha: 8 }
  const maximo = Math.max(1, ...dias.flatMap((d) => [d.facturado, d.cobrado]))
  const escala = (v) => (alto - margen.arriba - margen.abajo) * (v / maximo)
  const paso = (ancho - margen.izquierda - margen.derecha) / dias.length
  const barra = Math.max(2, Math.min(16, paso / 2 - 2))
  const base = alto - margen.abajo
  const marcas = [0, 0.5, 1].map((t) => ({ y: base - escala(maximo * t), v: Math.round(maximo * t) }))
  const cadaEtiqueta = Math.ceil(dias.length / 10)
  return `
    <svg class="grafico" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Facturado y cobrado por día">
      ${marcas.map((m) => `<line class="eje" x1="${margen.izquierda}" x2="${ancho - margen.derecha}" y1="${m.y}" y2="${m.y}"/><text x="${margen.izquierda - 6}" y="${m.y + 4}" text-anchor="end">${entero(m.v)}</text>`).join("")}
      ${dias.map((d, i) => {
        const x = margen.izquierda + i * paso + paso / 2
        return `
          <rect class="barra-facturado" x="${x - barra - 1}" y="${base - escala(d.facturado)}" width="${barra}" height="${escala(d.facturado)}" rx="2"><title>${d.etiqueta}: facturado ${dinero(d.facturado)}</title></rect>
          <rect class="barra-cobrado" x="${x + 1}" y="${base - escala(d.cobrado)}" width="${barra}" height="${escala(d.cobrado)}" rx="2"><title>${d.etiqueta}: cobrado ${dinero(d.cobrado)}</title></rect>
          ${i % cadaEtiqueta === 0 ? `<text x="${x}" y="${alto - 8}" text-anchor="middle">${d.corta}</text>` : ""}`
      }).join("")}
    </svg>`
}

const cargarPeriodo = async () => {
  $("#cifras-periodo").innerHTML = cargando(1)
  const inicio = aIsoServidor(periodo.desde)
  const fin = aIsoServidor(periodo.hasta)
  try {
    const [entregadas, pagos] = await Promise.all([
      pb.collection("ordenes").getFullList({
        filter: pb.filter('estado = "entregada" && fecha_entrega >= {:inicio} && fecha_entrega <= {:fin}', { inicio, fin }),
        sort: "-fecha_entrega",
        expand: "vehiculo,cliente",
      }),
      pb.collection("pagos").getFullList({ filter: pb.filter("created >= {:inicio} && created <= {:fin}", { inicio, fin }), fields: "monto,created,metodo" }),
    ])
    const facturado = entregadas.reduce((s, o) => s + o.total, 0)
    const cobrado = pagos.reduce((s, p) => s + p.monto, 0)
    const manoObra = entregadas.reduce((s, o) => s + o.total_mano_obra, 0)
    const efectivo = pagos.filter((p) => p.metodo === "efectivo").reduce((s, p) => s + p.monto, 0)
    $("#cifras-periodo").innerHTML = `
      <div class="cifra cifra--acento"><span class="etiqueta">Facturado</span><span class="cifra__valor">${dinero(facturado)}</span><span class="cifra__nota">${entregadas.length} órdenes entregadas</span></div>
      <div class="cifra cifra--ok"><span class="etiqueta">Cobrado</span><span class="cifra__valor">${dinero(cobrado)}</span><span class="cifra__nota">${pagos.length} pagos</span></div>
      <div class="cifra"><span class="etiqueta">Mano de obra</span><span class="cifra__valor">${dinero(manoObra)}</span><span class="cifra__nota">repuestos: ${dinero(facturado - manoObra)}</span></div>
      <div class="cifra"><span class="etiqueta">En efectivo</span><span class="cifra__valor">${dinero(efectivo)}</span><span class="cifra__nota">transferencia: ${dinero(cobrado - efectivo)}</span></div>`

    const dias = []
    for (let d = new Date(periodo.desde); d <= periodo.hasta; d.setDate(d.getDate() + 1)) {
      dias.push({ clave: claveDia(d), etiqueta: fecha(d), corta: `${d.getDate()}/${d.getMonth() + 1}`, facturado: 0, cobrado: 0 })
    }
    const porClave = Object.fromEntries(dias.map((d) => [d.clave, d]))
    entregadas.forEach((o) => {
      const d = porClave[claveDia(aFecha(o.fecha_entrega))]
      if (d) d.facturado += o.total
    })
    pagos.forEach((p) => {
      const d = porClave[claveDia(aFecha(p.created))]
      if (d) d.cobrado += p.monto
    })
    $("#grafico").innerHTML = dias.length > 62 ? vacio("Elija un período de hasta dos meses para ver el gráfico diario.", "reportes") : grafico(dias)

    $("#entregadas").innerHTML = entregadas.length === 0 ? vacio("No se entregaron órdenes en este período.", "orden") : `
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Entrega</th><th>Vehículo</th><th>Cliente</th><th class="num">Total</th><th class="num">Saldo</th></tr></thead>
        <tbody>${entregadas.map((o) => `<tr>
          <td>${fecha(o.fecha_entrega)}</td>
          <td><a href="orden.html?id=${o.id}">${placa(o.expand?.vehiculo?.matricula)}</a></td>
          <td>${escapar(o.expand?.cliente?.nombre)}</td>
          <td class="num">${dinero(o.total)}</td>
          <td class="num ${o.saldo > 0 ? "deuda" : ""}">${dinero(o.saldo)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">${dinero(facturado)}</td><td></td></tr></tfoot>
      </table></div>`
  } catch (error) {
    $("#cifras-periodo").innerHTML = `<div class="cifra">${escapar(mensajeError(error))}</div>`
  }
}

const cargarSaldos = async () => {
  try {
    const filas = await pb.collection("saldos_clientes").getFullList({ sort: "-saldo" })
    const total = filas.reduce((s, f) => s + f.saldo, 0)
    const maximo = Math.max(1, ...filas.map((f) => f.saldo))
    $("#total-deuda").textContent = `Total ${dinero(total)}`
    $("#saldos").innerHTML = filas.map((f) => `
      <a class="fila" href="clientes.html?id=${f.id}">
        ${avatar(f.nombre)}
        <div class="fila__cuerpo">
          <div class="fila__titulo">${escapar(f.nombre)}</div>
          <div class="medidor medidor--bajo"><span style="width:${(f.saldo / maximo) * 100}%"></span></div>
        </div>
        <div class="fila__fin"><strong class="deuda">${dinero(f.saldo)}</strong><div class="fila__sub">${f.ordenes_pendientes} ${f.ordenes_pendientes === 1 ? "orden" : "órdenes"}</div></div>
      </a>`).join("") || vacio("Nadie debe dinero al taller.", "check")
  } catch (error) {
    $("#saldos").innerHTML = vacio(mensajeError(error), "alerta")
  }
}

const cargarCarga = async () => {
  try {
    const filas = await pb.collection("carga_mecanicos").getFullList({ sort: "-abiertas,nombre" })
    $("#carga").innerHTML = filas.map((m) => `
      <div class="fila">
        ${avatar(m.nombre)}
        <div class="fila__cuerpo">
          <div class="fila__titulo">${escapar(m.nombre)}</div>
          <div class="fila__sub">Recibidas ${m.recibidas} · Diagnóstico ${m.en_diagnostico} · Reparación ${m.en_reparacion} · Listas ${m.listas}</div>
          <div class="apilada">
            <span class="relleno--recibida" style="flex:${m.recibidas}"></span>
            <span class="relleno--diagnostico" style="flex:${m.en_diagnostico}"></span>
            <span class="relleno--reparacion" style="flex:${m.en_reparacion}"></span>
            <span class="relleno--lista" style="flex:${m.listas}"></span>
          </div>
        </div>
        <strong>${m.abiertas}</strong>
      </div>`).join("") || vacio("No hay mecánicos registrados.", "clientes")
  } catch (error) {
    $("#carga").innerHTML = vacio(mensajeError(error), "alerta")
  }
}

const usuario = await iniciarPagina("reportes")

if (usuario) {
  if (!esPersonal()) {
    location.replace("index.html")
  } else {
    segmentos($("#periodo"), (valor) => {
      $("#rango").classList.toggle("oculto", valor !== "otro")
      if (valor === "otro") return
      establecer(...rango(valor))
      cargarPeriodo()
    })
    $("#rango").addEventListener("submit", (evento) => {
      evento.preventDefault()
      const { desde, hasta } = datosFormulario(evento.target)
      if (!desde || !hasta || desde > hasta) return
      const [a1, m1, d1] = desde.split("-").map(Number)
      const [a2, m2, d2] = hasta.split("-").map(Number)
      establecer(new Date(a1, m1 - 1, d1), new Date(a2, m2 - 1, d2))
      cargarPeriodo()
    })
    $("#boton-imprimir").addEventListener("click", () => window.print())
    establecer(...rango("mes"))
    await Promise.allSettled([cargarPeriodo(), cargarSaldos(), cargarCarga()])
    suscribir("ordenes", retrasar(() => Promise.allSettled([cargarSaldos(), cargarCarga()]), 500))
  }
}
