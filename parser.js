// 청위 보고자료 txt -> 분과별 {cur, next, req} 로 분리 (내용은 원문 그대로 유지)
(function (root) {
  var ORDER = ['초등부', '자모회', '중고등부', '복사단', '성소', '청년회', '룩스메아', '전달사항'];
  // 보고자료의 부서명 -> 엑셀 분과명 (포함 관계로 매칭)
  var ALIAS = [['성소', '성소'], ['룩스', '룩스메아'], ['전달', '전달사항']];

  function mapName(n) {
    n = n.trim();
    for (var i = 0; i < ORDER.length; i++) if (ORDER[i] === n) return n;
    for (var j = 0; j < ALIAS.length; j++) if (n.indexOf(ALIAS[j][0]) >= 0) return ALIAS[j][1];
    return n;
  }

  function detectMonth(text) {
    var m, re = /(\d{1,2})월/g, best = 99;
    while ((m = re.exec(text))) { var v = +m[1]; if (v >= 1 && v <= 12 && v < best) best = v; }
    return best === 99 ? new Date().getMonth() + 1 : best;
  }

  // 한 줄이 제목줄이면 'cur' | 'next' | 'req' 반환, 아니면 null (req 는 같은 줄 내용도 반환)
  function classify(line, cur, next) {
    var t = line.trim(), m;
    // 10월 / (10월 실시사항) / 10월 예정사항
    if ((m = t.match(/^\(?\s*(\d{1,2})월\s*(?:실시사항|예정사항)?\s*\)?$/))) return pick(+m[1]);
    // 실시사항 10월
    if ((m = t.match(/^(?:실시사항|예정사항)\s*(\d{1,2})월$/))) return pick(+m[1]);
    // 1. 실시사항 / 2. 예정사항 / 3. 건의 및 협조사항 : 없음
    if ((m = t.match(/^\d+\.\s*(실시사항|예정사항|건의.*?)\s*(?:[:：]\s*(.*))?$/))) {
      if (m[1] === '실시사항') return { to: 'cur' };
      if (m[1] === '예정사항') return { to: 'next' };
      return { to: 'req', rest: m[2] || '' };
    }
    return null;
    function pick(n) {
      if (n === cur) return { to: 'cur' };
      if (n === next) return { to: 'next' };
      return null;
    }
  }

  function parse(text, curMonth) {
    var nextMonth = curMonth % 12 + 1;
    var lines = text.replace(/\r/g, '').split('\n');
    var blocks = [], b = null, m;
    lines.forEach(function (ln) {
      if ((m = ln.match(/^\s*-{3,}\s*([^-]*?)\s*-{3,}\s*$/))) {
        b = m[1] ? { name: mapName(m[1]), lines: [] } : null;
        if (b) blocks.push(b);
      } else if (b) b.lines.push(ln);
    });

    var result = {};
    blocks.forEach(function (blk) {
      var out = { cur: [], next: [], req: [] };
      var hasHeader = blk.lines.some(function (l) { return classify(l, curMonth, nextMonth); });
      var target = hasHeader ? null : 'auto';
      blk.lines.forEach(function (ln) {
        var c = classify(ln, curMonth, nextMonth);
        if (c) {
          target = c.to;
          if (c.rest) out[c.to].push(c.rest);
          return;
        }
        var dest = target;
        if (dest === 'auto') {
          // 제목줄이 없는 분과: 날짜 앞머리(10/17, 10일)로 월 판단, 그 외 '11월...' 문구는 다음 달
          var d = ln.trim().match(/^(\d{1,2})\s*[\/월.]/);
          var mm = d ? +d[1] : 0;
          if (mm === curMonth) dest = 'cur';
          else if (mm === nextMonth) dest = 'next';
          else dest = out.cur.length && !/^\s*$/.test(ln) && !out.next.length && /월/.test(ln) ? 'next' : (out.next.length ? 'next' : 'cur');
        }
        if (dest) out[dest].push(ln);
      });
      ['cur', 'next', 'req'].forEach(function (k) {
        var a = out[k];
        while (a.length && !a[0].trim()) a.shift();
        while (a.length && !a[a.length - 1].trim()) a.pop();
        out[k] = a.map(function (s) { return s.replace(/\s+$/, ''); }).join('\n');
      });
      result[blk.name] = out;
    });

    var rows = ORDER.map(function (n) { return { name: n, d: result[n] || { cur: '', next: '', req: '' } }; });
    Object.keys(result).forEach(function (n) { if (ORDER.indexOf(n) < 0) rows.push({ name: n, d: result[n] }); });
    return rows.map(function (r) { return [r.name, r.d.cur, r.d.next, r.d.req]; });
  }

  var api = { parse: parse, detectMonth: detectMonth, ORDER: ORDER };
  if (typeof module !== 'undefined') module.exports = api; else root.Parser = api;
})(this);
