// Formsis · interacciones del sitio. Sin dependencias.
(function () {
  "use strict";

  var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var anio = $("#anio");
  if (anio) anio.textContent = String(new Date().getFullYear());

  // ---------- Navegación sólida y barra de progreso ----------
  var nav = $("#nav");
  var progreso = $("#progreso");
  function alDesplazar() {
    var y = window.scrollY;
    if (nav && !nav.classList.contains("nav-clara")) nav.classList.toggle("solida", y > 40);
    if (progreso) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progreso.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
    }
  }
  window.addEventListener("scroll", alDesplazar, { passive: true });
  alDesplazar();

  // ---------- Aparición al hacer scroll ----------
  var aparecen = $$(".aparece");
  if ("IntersectionObserver" in window && !reducido) {
    var ioAparece = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); ioAparece.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    aparecen.forEach(function (el) { ioAparece.observe(el); });
  } else {
    aparecen.forEach(function (el) { el.classList.add("visible"); });
  }

  // ---------- Campo de puntos del hero (reacciona al cursor) ----------
  var lienzo = $("#campo");
  if (lienzo && lienzo.getContext) {
    var ctx = lienzo.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var ancho = 0, alto = 0, paso = 30;
    var raton = { x: -9999, y: -9999 };
    var visibleHero = true, t0 = performance.now();
    function medir() {
      var r = lienzo.getBoundingClientRect();
      ancho = r.width; alto = r.height;
      lienzo.width = ancho * dpr; lienzo.height = alto * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paso = ancho < 700 ? 24 : 30;
    }
    function dibujar(t) {
      ctx.clearRect(0, 0, ancho, alto);
      var seg = (t - t0) / 1000;
      for (var y = paso / 2; y < alto; y += paso) {
        for (var x = paso / 2; x < ancho; x += paso) {
          var dx = x - raton.x, dy = y - raton.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var cerca = Math.max(0, 1 - d / 170);
          var ola = reducido ? 0 : (Math.sin(x * 0.012 + seg * 0.8) + Math.cos(y * 0.014 - seg * 0.6)) * 0.25 + 0.5;
          var r = 1 + cerca * 2.2;
          var px = x - (cerca > 0 ? dx / (d || 1) * cerca * 8 : 0);
          var py = y - (cerca > 0 ? dy / (d || 1) * cerca * 8 : 0);
          ctx.beginPath();
          ctx.arc(px, py, r, 0, 6.2832);
          if (cerca > 0.02) ctx.fillStyle = "rgba(34,193,127," + (0.25 + cerca * 0.75).toFixed(3) + ")";
          else ctx.fillStyle = "rgba(163,179,196," + (0.08 + ola * 0.12).toFixed(3) + ")";
          ctx.fill();
        }
      }
    }
    function bucle(t) {
      if (visibleHero) dibujar(t);
      if (!reducido) requestAnimationFrame(bucle);
    }
    medir();
    window.addEventListener("resize", function () { medir(); if (reducido) dibujar(performance.now()); });
    var hero = lienzo.parentElement;
    hero.addEventListener("pointermove", function (e) {
      var r = lienzo.getBoundingClientRect();
      raton.x = e.clientX - r.left; raton.y = e.clientY - r.top;
      if (reducido) dibujar(performance.now());
    });
    hero.addEventListener("pointerleave", function () { raton.x = raton.y = -9999; if (reducido) dibujar(performance.now()); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { visibleHero = e[0].isIntersecting; }).observe(hero);
    }
    if (reducido) dibujar(performance.now()); else requestAnimationFrame(bucle);
  }

  // ---------- Juguete: arma un formulario y apruébalo ----------
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  var BANDERA = '<svg class="bandera" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff"/><rect y="10" width="30" height="10" fill="#d52b1e"/><rect width="10" height="10" fill="#0039a6"/><path d="M5 2.6l.9 2.7h2.8l-2.3 1.7.9 2.7L5 8l-2.3 1.7.9-2.7L1.3 5.3h2.8z" fill="#fff"/></svg>';
  var PLANTILLAS = {
    nombre: '<span class="etq">Nombre completo</span><div class="caja"><span class="escribe" data-texto="Camila Rojas Fuentes"></span></div>',
    rut: '<span class="etq">RUT</span><div class="caja"><span class="escribe" data-texto="76.543.210-K"></span><span class="ok">' + CHECK + 'válido</span></div>',
    telefono: '<span class="etq">Teléfono</span><div class="caja">' + BANDERA + '<span class="escribe" data-texto="+56 9 6123 4567"></span></div>',
    documento: '<span class="etq">Estatutos de la empresa</span><div class="caja"><div class="archivo"><span class="pdf">PDF</span><span>estatutos.pdf <small>· 2,4 MB</small></span><span class="carga"><i></i></span></div></div>',
    firma: '<span class="etq">Firma</span><div class="caja firma"><svg viewBox="0 0 300 56" aria-hidden="true"><path d="M10 40 C 22 10, 34 8, 38 30 S 52 52, 62 26 S 80 12, 84 34 C 88 46, 100 44, 108 30 C 114 20, 124 22, 128 34 C 132 42, 150 40, 170 28 M 150 44 C 190 40, 240 36, 290 30"/></svg></div>',
    vida: '<span class="etq">Prueba de vida</span><div class="caja"><span class="ovalo-mini"></span><span>Selfie en vivo</span><span class="ok">' + CHECK + 'persona real</span></div>'
  };
  var NOMBRES = { nombre: "Nombre", rut: "RUT", telefono: "Teléfono", documento: "Documento", firma: "Firma", vida: "Prueba de vida" };
  var ficha = $("#ficha");
  if (ficha) {
    var lista = $("#campos"), vacio = $("#vacio"), enviar = $("#enviar"), estado = $("#estadoFicha");
    var barra = $("#barraFicha"), contador = $("#contador"), chips = $$(".chip");
    var agregados = [], temporizadores = [];
    var esperar = function (fn, ms) { temporizadores.push(setTimeout(fn, reducido ? 0 : ms)); };

    function escribir(el) {
      var texto = el.getAttribute("data-texto"), i = 0;
      if (reducido) { el.textContent = texto; return; }
      el.classList.add("cursor");
      (function siguiente() {
        el.textContent = texto.slice(0, ++i);
        if (i < texto.length) esperar(siguiente, 38 + Math.random() * 40);
        else esperar(function () { el.classList.remove("cursor"); }, 600);
      })();
    }
    function actualizar() {
      var n = agregados.length;
      contador.textContent = n + (n === 1 ? " campo" : " campos");
      barra.style.width = Math.round((n / chips.length) * 100) + "%";
      enviar.disabled = n < 2;
      vacio.hidden = n > 0;
    }
    function agregar(tipo) {
      if (!PLANTILLAS[tipo] || agregados.indexOf(tipo) !== -1 || ficha.classList.contains("aprobada")) return;
      agregados.push(tipo);
      var li = document.createElement("li");
      li.className = "campo" + (tipo === "vida" ? " selfie" : "");
      li.innerHTML = PLANTILLAS[tipo];
      lista.appendChild(li);
      $$(".escribe", li).forEach(escribir);
      var chip = $('.chip[data-campo="' + tipo + '"]');
      if (chip) { chip.disabled = true; chip.setAttribute("aria-label", NOMBRES[tipo] + ", agregado"); }
      actualizar();
    }
    function fijarEstado(clave, texto) { estado.setAttribute("data-e", clave); estado.textContent = texto; }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () { agregar(chip.getAttribute("data-campo")); });
      chip.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", chip.getAttribute("data-campo"));
        e.dataTransfer.effectAllowed = "copy";
      });
    });
    ficha.addEventListener("dragover", function (e) { e.preventDefault(); ficha.classList.add("soltando"); });
    ficha.addEventListener("dragleave", function (e) { if (!ficha.contains(e.relatedTarget)) ficha.classList.remove("soltando"); });
    ficha.addEventListener("drop", function (e) {
      e.preventDefault(); ficha.classList.remove("soltando");
      agregar(e.dataTransfer.getData("text/plain"));
    });

    enviar.addEventListener("click", function () {
      enviar.disabled = true;
      chips.forEach(function (c) { c.disabled = true; });
      fijarEstado("enviado", "Enviado");
      esperar(function () { fijarEstado("revision", "En revisión"); }, 900);
      esperar(function () {
        fijarEstado("aprobado", "Aprobado");
        ficha.classList.add("aprobada");
        var r = $("#reiniciar");
        esperar(function () { r.focus({ preventScroll: true }); }, 900);
      }, 2000);
    });
    $("#reiniciar").addEventListener("click", function () {
      temporizadores.forEach(clearTimeout); temporizadores = [];
      agregados = [];
      ficha.classList.remove("aprobada");
      $$(".campo", lista).forEach(function (li) { li.remove(); });
      chips.forEach(function (c) { c.disabled = false; c.removeAttribute("aria-label"); });
      estado.removeAttribute("data-e"); estado.textContent = "Borrador";
      actualizar();
      if (chips[0]) chips[0].focus({ preventScroll: true });
    });
    actualizar();
  }

  // ---------- Cómo funciona: escenario fijo que cambia con cada paso ----------
  var pasos = $$(".paso");
  var escenas = $$(".escena");
  var puntos = $$(".puntos-paso i");
  var qr = $("#qr");
  if (qr) {
    // Patrón de QR decorativo (21x21) con sus tres marcas de posición.
    var semilla = 7;
    var azar = function () { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    var marca = function (x, y) {
      var bloques = [[0, 0], [14, 0], [0, 14]];
      for (var b = 0; b < 3; b++) {
        var ox = x - bloques[b][0], oy = y - bloques[b][1];
        if (ox >= 0 && ox < 7 && oy >= 0 && oy < 7) {
          return ox === 0 || ox === 6 || oy === 0 || oy === 6 || (ox >= 2 && ox <= 4 && oy >= 2 && oy <= 4) ? 1 : 0;
        }
        if (ox >= -1 && ox < 8 && oy >= -1 && oy < 8) return 0;
      }
      return -1;
    };
    var html = "";
    for (var y = 0; y < 21; y++) {
      for (var x = 0; x < 21; x++) {
        var m = marca(x, y);
        var lleno = m === -1 ? azar() > 0.52 : m === 1;
        html += "<i" + (lleno ? "" : ' class="blanco"') + "></i>";
      }
    }
    qr.innerHTML = html;
    $$("i", qr).forEach(function (celda, i) { celda.style.transitionDelay = ((i % 21 + Math.floor(i / 21)) * 18) + "ms"; });
  }
  var cadenaTimers = [];
  function animarCadena(activa) {
    cadenaTimers.forEach(clearTimeout); cadenaTimers = [];
    var nodos = $$("#cadena .nivel"), uniones = $$("#cadena .union"), est = $("#estadoCadena");
    if (!nodos.length) return;
    nodos.concat(uniones).forEach(function (n) { n.classList.remove("ok"); });
    est.setAttribute("data-e", "revision"); est.textContent = "En revisión";
    if (!activa) return;
    var orden = [nodos[0], uniones[0], nodos[1], uniones[1], nodos[2]];
    orden.forEach(function (el, i) {
      cadenaTimers.push(setTimeout(function () { el.classList.add("ok"); }, reducido ? 0 : 400 + i * 450));
    });
    cadenaTimers.push(setTimeout(function () { est.setAttribute("data-e", "aprobado"); est.textContent = "Aprobado"; }, reducido ? 0 : 400 + orden.length * 450));
  }
  var escenaActual = -1;
  function mostrarEscena(i) {
    if (i === escenaActual) return;
    escenaActual = i;
    escenas.forEach(function (e, j) { e.classList.toggle("on", j === i); });
    puntos.forEach(function (p, j) { p.classList.toggle("on", j === i); });
    pasos.forEach(function (p, j) { p.classList.toggle("activo", j === i); });
    animarCadena(i === 3);
  }
  if (pasos.length && "IntersectionObserver" in window) {
    var ioPasos = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) mostrarEscena(Number(e.target.getAttribute("data-escena")));
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    pasos.forEach(function (p) { ioPasos.observe(p); });
    mostrarEscena(0);
  }

  // ---------- Contador del número de tipos ----------
  $$("[data-cuenta]").forEach(function (el) {
    var meta = Number(el.getAttribute("data-cuenta"));
    if (reducido || !("IntersectionObserver" in window)) return;
    el.textContent = "0";
    var io = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      io.disconnect();
      var inicio = performance.now();
      (function cuadro(t) {
        var p = Math.min(1, (t - inicio) / 1400);
        el.textContent = String(Math.round(meta * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(cuadro);
      })(inicio);
    }, { threshold: 0.5 });
    io.observe(el);
  });

  // ---------- Foco de luz que sigue al cursor en la rejilla ----------
  var rejilla = $("#rejilla");
  if (rejilla) {
    rejilla.addEventListener("pointermove", function (e) {
      $$(".tipo", rejilla).forEach(function (t) {
        var r = t.getBoundingClientRect();
        t.style.setProperty("--x", (e.clientX - r.left) + "px");
        t.style.setProperty("--y", (e.clientY - r.top) + "px");
      });
    });
  }

  // ---------- Prueba de vida interactiva ----------
  var camara = $("#camara");
  if (camara) {
    var rasgos = $("#rasgos"), cabeza = $("#cabeza"), indicacion = $("#indicacion");
    var resultado = $("#resultadoVida"), itemsReto = $$("#retos li");
    var orden = ["izq", "der", "centro"], textos = { izq: "Gira a la izquierda", der: "Gira a la derecha", centro: "Mira al frente" };
    var actual = 0, giro = 0;
    function pintarGiro() {
      rasgos.style.transform = "translateX(" + (giro * 30).toFixed(1) + "px)";
      cabeza.setAttribute("rx", (70 - Math.abs(giro) * 8).toFixed(1));
      cabeza.setAttribute("cx", (100 + giro * 8).toFixed(1));
    }
    function cumple(reto) {
      if (reto === "izq") return giro < -0.55;
      if (reto === "der") return giro > 0.55;
      return Math.abs(giro) < 0.15;
    }
    function avanzar() {
      itemsReto[actual].classList.add("ok");
      actual++;
      if (actual >= orden.length) {
        camara.removeAttribute("data-reto");
        camara.classList.add("lista");
        indicacion.textContent = "Listo";
        resultado.innerHTML = '<span class="estado" data-e="aprobado">Persona real · 0,98</span><button class="texto-boton" type="button" id="repetirVida">Repetir</button>';
        $("#repetirVida").addEventListener("click", reiniciarVida);
        return;
      }
      camara.setAttribute("data-reto", orden[actual]);
      indicacion.textContent = textos[orden[actual]];
    }
    function reiniciarVida() {
      actual = 0;
      itemsReto.forEach(function (li) { li.classList.remove("ok"); });
      camara.classList.remove("lista");
      camara.setAttribute("data-reto", "izq");
      indicacion.textContent = textos.izq;
      resultado.innerHTML = "";
      camara.focus({ preventScroll: true });
    }
    // Cada reto se cumple al sostener la pose un instante (o al instante con el teclado).
    var espera = null;
    function evaluar(inmediato) {
      if (actual >= orden.length) return;
      if (!cumple(orden[actual])) { clearTimeout(espera); espera = null; return; }
      if (inmediato || reducido) { clearTimeout(espera); espera = null; avanzar(); return; }
      if (espera) return;
      espera = setTimeout(function () {
        espera = null;
        if (actual < orden.length && cumple(orden[actual])) avanzar();
      }, 380);
    }
    camara.addEventListener("pointermove", function (e) {
      var r = camara.getBoundingClientRect();
      giro = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2.4));
      pintarGiro(); evaluar();
    });
    camara.addEventListener("pointerleave", function () {
      // Al salir, la cara vuelve sola al centro.
      var paso = function () {
        giro *= 0.8;
        if (Math.abs(giro) < 0.02) giro = 0;
        pintarGiro(); evaluar();
        if (giro !== 0) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
    camara.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") giro = Math.max(-1, giro - 0.35);
      else if (e.key === "ArrowRight") giro = Math.min(1, giro + 0.35);
      else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Home") giro = 0;
      else return;
      e.preventDefault();
      pintarGiro();
      evaluar(true);
    });
    // Parpadeo ocasional.
    if (!reducido) {
      setInterval(function () {
        ["#ojoI", "#ojoD"].forEach(function (s) {
          var o = $(s); o.setAttribute("ry", "1");
          setTimeout(function () { o.setAttribute("ry", "7.5"); }, 130);
        });
      }, 3800);
    }
  }

  // ---------- Tu marca: recolorear el portal ----------
  var portal = $("#portal");
  if (portal) {
    $$(".muestra").forEach(function (m) {
      m.style.setProperty("--c", m.getAttribute("data-c"));
      m.addEventListener("click", function () {
        $$(".muestra").forEach(function (o) { o.setAttribute("aria-pressed", String(o === m)); });
        portal.style.setProperty("--marca", m.getAttribute("data-c"));
        $("#portalNombre").textContent = m.getAttribute("data-n");
        $("#portalLogo").textContent = m.getAttribute("data-i");
      });
    });
  }

  // ---------- Webhooks: un paquete viaja a cada destino ----------
  var paquete = $("#paquete");
  if (paquete && !reducido && $("#c0") && $("#c0").getTotalLength) {
    var cables = [$("#c0"), $("#c1"), $("#c2")], destinos = $$(".destino"), idx = 0, inicioViaje = 0, viendo = false;
    var cajaCables = $("#cables");
    function viajar(t) {
      if (viendo) {
        if (!inicioViaje) inicioViaje = t;
        var c = cables[idx], largo = c.getTotalLength(), p = Math.min(1, (t - inicioViaje) / 1100);
        var punto = c.getPointAtLength(largo * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2));
        var caja = cajaCables.getBoundingClientRect();
        paquete.style.opacity = "1";
        paquete.style.transform = "translate(" + (punto.x / 400 * caja.width).toFixed(1) + "px," + (punto.y / 220 * caja.height).toFixed(1) + "px)";
        if (p >= 1) {
          var d = destinos[idx];
          d.classList.add("ping");
          setTimeout(function () { d.classList.remove("ping"); }, 700);
          idx = (idx + 1) % cables.length; inicioViaje = t + 350;
        }
      }
      requestAnimationFrame(viajar);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { viendo = e[0].isIntersecting; inicioViaje = 0; }).observe($("#cables"));
    }
    requestAnimationFrame(viajar);
  }

  // ---------- Índice de las páginas de lectura ----------
  var enlacesIndice = $$(".indice a");
  if (enlacesIndice.length && "IntersectionObserver" in window) {
    var porId = {};
    enlacesIndice.forEach(function (a) { porId[a.getAttribute("href").slice(1)] = a; });
    var ioIndice = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        enlacesIndice.forEach(function (a) { a.classList.remove("actual"); });
        var a = porId[e.target.id];
        if (a) a.classList.add("actual");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(porId).forEach(function (id) { var h = document.getElementById(id); if (h) ioIndice.observe(h); });
  }
})();
