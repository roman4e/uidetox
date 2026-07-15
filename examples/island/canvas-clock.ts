import { defineComponent } from 'ui-detox';

/**
 * Hand-written island wrapper equivalent to CanvasClock.md, showing the
 * lifecycle contract directly. This is the shape a Cytoscape / Monaco / D3
 * wrapper takes.
 */
defineComponent({
  tag: 'canvas-clock',
  props: ['size'],
  render: 'never', // SSR emits a placeholder; the canvas is client-only
  boot: (ctx) => {
    const canvas = document.createElement('canvas');
    const size = Number(ctx.props.size ?? 200);
    canvas.width = size;
    canvas.height = size;
    ctx.refs.face = canvas;
    return canvas;
  },
  onMount: (ctx) => {
    const canvas = ctx.refs.face as HTMLCanvasElement;
    const g = canvas.getContext('2d');
    let raf = 0;
    const draw = () => {
      if (!g) return;
      const now = new Date();
      const r = canvas.width / 2;
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.translate(r, r);
      const sec = now.getSeconds() + now.getMilliseconds() / 1000;
      const a = (sec / 60) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      g.stroke();
      g.translate(-r, -r);
      ctx.emit('tick', { seconds: sec });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // teardown returned from onMount — runs on disconnect
    return () => cancelAnimationFrame(raf);
  },
});
