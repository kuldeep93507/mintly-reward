export class Emitter<T> {
  private ls = new Set<(v: T) => void>();
  on(l: (v: T) => void) { this.ls.add(l); return () => { this.ls.delete(l); }; }
  emit(v: T) { for (const l of [...this.ls]) l(v); }
  clear() { this.ls.clear(); }
}
