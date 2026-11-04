/* Magotto Barbearia — scripts do site */
(() => {
  'use strict';

  /* Posição inicial: o browser deixa de repor o scroll sozinho (refresh, voltar atrás) */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // Um #secção no URL só conta quando se chega de outra página (ex.: privacidade.html → index.html#servicos).
  // Num refresh a página volta sempre ao topo. Em qualquer caso o # sai do URL.
  const navEntry = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  const isReload = navEntry ? navEntry.type === 'reload' : false;
  const hashId = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '';
  let initialTarget = !isReload && hashId && document.getElementById(hashId) ? hashId : '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const mobileMQ = matchMedia('(max-width: 700px)');
  const hasIO = 'IntersectionObserver' in window;
  const header = document.querySelector('header');
  const hero = document.querySelector('.hero');
  const footer = document.querySelector('.site-footer');

  /* Scroll sem animação (ignora o scroll-behavior:smooth do CSS) */
  const jumpTo = (top) => {
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, top);
    root.style.scrollBehavior = prev;
  };
  /* Altura real do header quando está fixo (telemóvel); no desktop o header não acompanha o scroll */
  const headerOffset = () => {
    if (!header || getComputedStyle(header).position !== 'fixed') return 0;
    return header.getBoundingClientRect().bottom + 16;
  };
  /* Função única para todos os links internos: id vazio = topo da página */
  const scrollToSection = (id, immediate) => {
    let top = 0;
    if (id) {
      const target = document.getElementById(id);
      if (!target) return;
      top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
    }
    top = Math.max(0, Math.round(top));
    if (immediate || reduceMotion) jumpTo(top);
    else window.scrollTo({ top, behavior: 'smooth' });
  };

  /* Abrir ou atualizar o site leva ao topo (ou à secção pedida por outra página).
     Repete-se no DOMContentLoaded, no load e no pageshow, mais um frame depois,
     porque o iOS Safari às vezes repõe o scroll depois do load. Para assim que o utilizador mexe na página. */
  let userMoved = false;
  ['wheel', 'touchstart', 'keydown'].forEach((type) => addEventListener(type, () => { userMoved = true; }, { passive: true, once: true }));
  const settle = () => {
    if (userMoved) return;
    if (initialTarget) scrollToSection(initialTarget, true);
    else jumpTo(0);
  };
  const settleTwice = () => { settle(); requestAnimationFrame(() => requestAnimationFrame(settle)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settleTwice);
  else settleTwice();
  addEventListener('load', settleTwice);
  addEventListener('pageshow', (e) => {
    if (e.persisted) { userMoved = false; initialTarget = ''; }
    settleTwice();
    // depois do arranque, um #secção antigo deixa de contar
    setTimeout(() => { initialTarget = ''; }, 1000);
  });

  /* Um único listener de scroll (passivo + requestAnimationFrame) para tudo o que depende da posição */
  const scrollTasks = [];
  let scrollFrame = 0;
  const runScrollTasks = () => { scrollFrame = 0; scrollTasks.forEach((task) => task()); };
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(runScrollTasks); }, { passive: true });

  /* Header: transparente sobre o hero, sólido depois de 40px de scroll (sem hero, sempre sólido) */
  if (header) {
    if (!hero) header.classList.add('is-scrolled');
    else {
      const updateHeader = () => header.classList.toggle('is-scrolled', scrollY > 40);
      scrollTasks.push(updateHeader);
      updateHeader();
    }
  }

  /* Menu no telemóvel: ecrã inteiro, foco preso, fecha com X, Esc, link ou botão voltar */
  let closeMenuForNavigation = () => false;
  const menuToggle = document.querySelector('.menu-toggle');
  const menuPanel = menuToggle && document.getElementById(menuToggle.getAttribute('aria-controls'));
  if (menuToggle && menuPanel) {
    const outside = [document.querySelector('main'), footer, document.querySelector('.book-float'),
      document.querySelector('.skip-link'), header.querySelector('.brand')].filter(Boolean);
    let closeTimer = 0;
    const isOpen = () => menuToggle.getAttribute('aria-expanded') === 'true';
    const focusables = () => [menuToggle, ...menuPanel.querySelectorAll('a[href], button:not([disabled])')];

    const openMenu = () => {
      clearTimeout(closeTimer);
      menuPanel.hidden = false;
      void menuPanel.offsetWidth; // força o reflow para a transição de entrada
      menuPanel.classList.add('is-open');
      header.classList.add('menu-is-open');
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.setAttribute('aria-label', 'Fechar menu');
      document.body.classList.add('menu-open');
      outside.forEach((el) => { el.inert = true; });
      history.pushState({ menu: true }, '');
      const first = menuPanel.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    };

    // Fecha o painel (sem mexer no histórico)
    const finishClose = (returnFocus) => {
      if (!isOpen()) return;
      menuPanel.classList.remove('is-open');
      header.classList.remove('menu-is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Abrir menu');
      document.body.classList.remove('menu-open');
      outside.forEach((el) => { el.inert = false; });
      closeTimer = setTimeout(() => { menuPanel.hidden = true; }, reduceMotion ? 0 : 300);
      if (returnFocus) menuToggle.focus({ preventScroll: true });
    };

    // Fecha e remove a entrada que o menu acrescentou ao histórico
    const closeMenu = (returnFocus) => {
      if (!isOpen()) return;
      if (history.state && history.state.menu) {
        closeMenu.returnFocus = returnFocus;
        history.back(); // o popstate trata do resto
      } else {
        finishClose(returnFocus);
      }
    };

    // Botão voltar do telemóvel (ou X / Esc, que usam history.back): só fecha o menu
    addEventListener('popstate', () => {
      if (!isOpen()) return;
      finishClose(closeMenu.returnFocus !== false);
      closeMenu.returnFocus = undefined;
    });

    // Fecha o menu para seguir um link, SEM percorrer o histórico: um history.back() aqui
    // faria o Safari repor a posição de scroll antiga por cima do scroll até à secção.
    closeMenuForNavigation = () => {
      if (!isOpen()) return false;
      finishClose(false);
      // a entrada que o menu acrescentou passa a ser uma entrada normal da mesma página
      if (history.state && history.state.menu) history.replaceState(null, '', location.pathname + location.search);
      return true;
    };

    menuToggle.addEventListener('click', () => (isOpen() ? closeMenu(true) : openMenu()));
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
      if (e.key === 'Tab') {
        const list = focusables();
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Links externos ou para outra página: fecha sem tocar no histórico (os internos são tratados abaixo)
    menuPanel.querySelectorAll('a:not([href^="#"])').forEach((link) => {
      link.addEventListener('click', () => finishClose(false));
    });
    mobileMQ.addEventListener('change', (e) => { if (!e.matches) closeMenu(false); });
  }

  /* Revelação de conteúdo ao fazer scroll */
  const revealItems = document.querySelectorAll('.reveal');
  if (hasIO) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((el) => observer.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add('visible'));
  }

  /* Acordeão de serviços */
  const setService = (service, open, reveal) => {
    const button = service.querySelector('button');
    service.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
    if (open && reveal) {
      // depois de abrir, garante que o serviço fica todo visível
      setTimeout(() => {
        const r = service.getBoundingClientRect();
        // deixa espaço para o botão flutuante de marcação
        const bookFab = document.querySelector('.book-float.is-visible');
        const bottomLimit = innerHeight - (bookFab ? innerHeight - bookFab.getBoundingClientRect().top + 8 : 0);
        if (r.bottom > bottomLimit || r.top < 0) service.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }, reduceMotion ? 0 : 420);
    }
  };
  document.querySelectorAll('.service button').forEach((button) => {
    button.addEventListener('click', () => {
      const service = button.parentElement;
      setService(service, !service.classList.contains('open'), true);
    });
  });

  /* "Cortes Kids" abre o respetivo painel (também quando se chega de outra página) */
  const kids = document.getElementById('cortes-kids');
  if (kids && initialTarget === 'cortes-kids') setService(kids, true, false);

  /* Todos os links internos (header, menu, hero, secções, rodapé, voltar ao topo, skip link):
     o href="#..." fica no HTML para funcionar sem JavaScript; com JS, o scroll é feito por
     scrollToSection, com a altura real do header, e o URL não ganha #. */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = id ? document.getElementById(id) : null;
    if (id && !target) return;
    e.preventDefault();
    if (id === 'cortes-kids' && kids) setService(kids, true, false);
    // acessibilidade: o foco acompanha a navegação (sem provocar outro scroll)
    const moveFocus = () => {
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    if (closeMenuForNavigation()) {
      // o menu fechou e o body voltou a ter scroll: só no frame seguinte é que se navega
      requestAnimationFrame(() => requestAnimationFrame(() => { scrollToSection(id); moveFocus(); }));
    } else {
      scrollToSection(id);
      moveFocus();
    }
  });

  /* Parallax suave da imagem do hero (desligado em ecrãs tácteis e com movimento reduzido) */
  const heroImage = document.getElementById('hero-image');
  if (heroImage && !reduceMotion && !isTouch) {
    scrollTasks.push(() => {
      if (scrollY < innerHeight) heroImage.style.transform = 'translateY(' + scrollY * 0.16 + 'px)';
    });
  }

  /* Galeria em carrossel (telemóvel): indicador de posição */
  const gallery = document.querySelector('.gallery');
  const galleryCount = document.querySelector('.gallery-count');
  if (gallery && galleryCount) {
    const figures = [...gallery.querySelectorAll('figure')];
    const dots = [...document.querySelectorAll('.gallery-dots i')];
    let current = 0;
    const setCurrent = (index) => {
      if (index === current) return;
      current = index;
      galleryCount.textContent = (index + 1) + ' / ' + figures.length;
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    };
    let frame = 0;
    gallery.addEventListener('scroll', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const left = gallery.getBoundingClientRect().left;
        let best = 0;
        let bestDist = Infinity;
        figures.forEach((f, i) => {
          const dist = Math.abs(f.getBoundingClientRect().left - left - parseFloat(getComputedStyle(gallery).scrollPaddingLeft || 0));
          if (dist < bestDist) { bestDist = dist; best = i; }
        });
        setCurrent(best);
      });
    }, { passive: true });
  }

  /* Botão flutuante de marcação (logo da Magotto): aparece depois do hero e
     sobe quando a barra inferior do rodapé está visível, para não tapar os créditos. */
  const fab = document.querySelector('.book-float');
  let pastHero = !hero;
  let footerVisible = false;
  let labelShown = false;
  const placeFab = () => {
    if (!fab) return;
    let lift = 0;
    if (footerVisible && footer) {
      const strip = footer.querySelector('.footer-bottom') || footer;
      const overlap = innerHeight - strip.getBoundingClientRect().top;
      const base = innerWidth <= 700 ? 16 : 20;
      if (overlap + 12 > base) lift = overlap + 12;
    }
    // sem sobreposição, a posição (com a safe area do iPhone) fica a cargo do CSS
    fab.style.bottom = lift ? lift + 'px' : '';
  };
  const updateFixed = () => {
    if (!fab) return;
    fab.classList.toggle('is-visible', pastHero);
    // em ecrãs tácteis, o rótulo "Marcar" aparece sozinho 3 s na primeira vez que o botão surge
    if (pastHero && !labelShown && isTouch) {
      labelShown = true;
      fab.classList.add('show-label');
      setTimeout(() => fab.classList.remove('show-label'), 3000);
    }
    placeFab();
  };
  if (hasIO) {
    if (hero) {
      new IntersectionObserver(([entry]) => {
        pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        updateFixed();
      }).observe(hero);
    }
    if (footer) {
      new IntersectionObserver(([entry]) => {
        footerVisible = entry.isIntersecting;
        updateFixed();
      }).observe(footer);
    }
  } else {
    pastHero = true;
  }
  scrollTasks.push(() => { if (footerVisible) placeFab(); });
  addEventListener('resize', placeFab);
  updateFixed();

  /* Ano no rodapé */
  const year = document.getElementById('footer-year');
  if (year) year.textContent = new Date().getFullYear();
})();
