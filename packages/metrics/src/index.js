/**
 * Lightweight Prometheus-compatible metrics registry.
 * 
 * Exposes a minimal API for counters, gauges, and histograms.
 * Does NOT rely on any specific backend infrastructure (no DB required).
 */

class Metric {
  constructor(name, help, type) {
    this.name = name;
    this.help = help;
    this.type = type;
    this.values = new Map(); // label hash -> value object
  }

  _hashLabels(labels = {}) {
    const keys = Object.keys(labels).sort();
    if (keys.length === 0) return "";
    return keys.map(k => `${k}="${this._escape(labels[k])}"`).join(",");
  }

  _escape(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/"/g, "\\\"");
  }

  render() {
    let out = `# HELP ${this.name} ${this.help}\n`;
    out += `# TYPE ${this.name} ${this.type}\n`;
    
    for (const [hash, valueObj] of this.values.entries()) {
      const labels = hash ? `{${hash}}` : "";
      
      if (this.type === "histogram") {
        for (const bucket of valueObj.buckets) {
          out += `${this.name}_bucket${hash ? `{${hash},le="${bucket.le}"}` : `{le="${bucket.le}"}`} ${bucket.count}\n`;
        }
        out += `${this.name}_bucket${hash ? `{${hash},le="+Inf"}` : `{le="+Inf"}`} ${valueObj.count}\n`;
        out += `${this.name}_sum${labels} ${valueObj.sum}\n`;
        out += `${this.name}_count${labels} ${valueObj.count}\n`;
      } else {
        out += `${this.name}${labels} ${valueObj.value}\n`;
      }
    }
    
    return out;
  }
}

class Registry {
  constructor() {
    this._metrics = new Map();
  }

  _getOrCreate(name, help, type, valueFactory) {
    if (!this._metrics.has(name)) {
      this._metrics.set(name, new Metric(name, help, type));
    }
    const metric = this._metrics.get(name);
    return {
      metric,
      getValue: (labels) => {
        const hash = metric._hashLabels(labels);
        if (!metric.values.has(hash)) {
          metric.values.set(hash, valueFactory());
        }
        return metric.values.get(hash);
      }
    };
  }

  counter({ name, help }) {
    const { getValue } = this._getOrCreate(name, help, "counter", () => ({ value: 0 }));
    
    return {
      inc: (labels = {}, value = 1) => {
        const val = getValue(labels);
        val.value += value;
      }
    };
  }

  gauge({ name, help }) {
    const { getValue } = this._getOrCreate(name, help, "gauge", () => ({ value: 0 }));
    
    return {
      set: (labels = {}, value) => {
        const val = getValue(labels);
        val.value = value;
      },
      inc: (labels = {}, value = 1) => {
        const val = getValue(labels);
        val.value += value;
      },
      dec: (labels = {}, value = 1) => {
        const val = getValue(labels);
        val.value -= value;
      }
    };
  }

  histogram({ name, help, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] }) {
    const { getValue } = this._getOrCreate(name, help, "histogram", () => {
      const bucketCounts = buckets.map(le => ({ le, count: 0 }));
      return { sum: 0, count: 0, buckets: bucketCounts };
    });
    
    return {
      observe: (labels = {}, value) => {
        const val = getValue(labels);
        val.sum += value;
        val.count += 1;
        for (const bucket of val.buckets) {
          if (value <= bucket.le) {
            bucket.count += 1;
          }
        }
      },
      startTimer: (labels = {}) => {
        const start = process.hrtime.bigint();
        return () => {
          const end = process.hrtime.bigint();
          const durationSec = Number(end - start) / 1e9;
          
          const val = getValue(labels);
          val.sum += durationSec;
          val.count += 1;
          for (const bucket of val.buckets) {
            if (durationSec <= bucket.le) {
              bucket.count += 1;
            }
          }
          return durationSec;
        };
      }
    };
  }

  metrics() {
    let out = "";
    for (const metric of this._metrics.values()) {
      out += metric.render();
    }
    return out;
  }
  
  clear() {
    this._metrics.clear();
  }
}

export const registry = new Registry();
