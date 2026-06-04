function computeSigmaRef({from,to,strength,groupId,includeOut,cfg}){
  try{
    const all = (window.cubesForEvaluation ? cubesForEvaluation({from,to,strengthClass:strength,groupId,ageDays:null}) : []);
    const ageFiltered = (includeOut || cfg.includeOutOfAge) ? all : all.filter(c => {
      const age = Number(c.cureDays ?? c.age ?? 28);
      return Number.isFinite(age) && Math.abs(age - (cfg.ageNominal||28)) <= (cfg.ageTolerance||2);
    });
    const withFck = ageFiltered.map(c=>({c, fck: parseFckFromStrength(String(c.strengthClass||''))}))
      .filter(o=>o.fck!=null && Number.isFinite(o.c?.resultMPa));

    const meanOf = a => a.length? a.reduce((s,x)=>s+x,0)/a.length : NaN;
    const stdevSample = a => { const n=a.length; if (n<2) return NaN; const mu=meanOf(a); let v=0; for(const x of a) v+=(x-mu)*(x-mu); return Math.sqrt(v/(n-1)); };
    const deltas = (arr)=> arr.map(o=> o.c.resultMPa - o.fck);

    // Preferred: latest35 per EN 206
    let sigma = NaN;
    if ((cfg.sigmaSource||'latest35') === 'previousPeriod' && from && to){
      const dtFrom = new Date(from), dtTo = new Date(to);
      const days = Math.max(1, Math.round((dtTo - dtFrom) / 86400000) + 1);
      const prevTo = new Date(dtFrom.getTime() - 86400000);
      const prevFrom = new Date(prevTo.getTime() - (days-1)*86400000);
      const prevAll = (window.cubesForEvaluation ? cubesForEvaluation({from: prevFrom.toISOString().slice(0,10), to: prevTo.toISOString().slice(0,10), strengthClass:strength, groupId, ageDays:null}) : []);
      const prevAge = (includeOut || cfg.includeOutOfAge) ? prevAll : prevAll.filter(c => {
        const age = Number(c.cureDays ?? c.age ?? 28);
        return Number.isFinite(age) && Math.abs(age - (cfg.ageNominal||28)) <= (cfg.ageTolerance||2);
      });
      const prevWithFck = prevAge.map(c=>({c, fck: parseFckFromStrength(String(c.strengthClass||''))}))
        .filter(o=>o.fck!=null && Number.isFinite(o.c?.resultMPa));
      const dprev = deltas(prevWithFck);
      if (dprev.length >= 2) sigma = stdevSample(dprev);
    }
    if (!Number.isFinite(sigma)){
      const d = deltas(withFck);
      const last = d.slice(-Math.min(35, d.length));
      sigma = (last.length >= 2 ? stdevSample(last) : NaN);
    }
    return sigma;
  }catch(e){ return NaN; }
}
