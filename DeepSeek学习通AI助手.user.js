// ==UserScript==
// @name         DeepSeek学习通全能助手
// @version      7.6.0
// @description  AI自动答题+智能刷课+考试。DeepSeek API驱动，OCS结构检测，Indigo-Blue Modern UI
// @match        *://*.chaoxing.com/*
// @connect      api.deepseek.com
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_info
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    var _w = unsafeWindow, _l = location, _d = document;
    var _jq = (typeof _w.jQuery === 'function') ? _w.jQuery : null;
    var _UE = _w.UE;

    // ═══════════ DOM helpers (jQuery with raw fallback) ═══════════
    function $(sel, ctx) {
        if (_jq) {
            try { var j = (ctx && ctx.querySelectorAll) ? _jq(ctx).find(sel) : _jq(sel); if (j && j.length) return j; } catch(e) {}
        }
        var parent = ctx || document;
        var els = parent.querySelectorAll(sel);
        if (!els || !els.length) return emptySet();
        var wrap = {
            length: els.length, 0: els[0],
            find: function(s) { return $(s, els[0]); },
            each: function(fn) { for (var i=0;i<els.length;i++) fn.call(els[i], i, els[i]); return wrap; },
            eq: function(i) { return singleSet(els[i]); },
            text: function() { var t=''; for(var i=0;i<els.length;i++)t+=(els[i].textContent||''); return t; },
            val: function(v) { if(v!==undefined){els[0].value=v;return wrap;} return els[0]?(els[0].value||''):''; },
            attr: function(a) { return els[0]?els[0].getAttribute(a)||'':''; },
            is: function(s) { return els[0]?els[0].matches(s):false; },
            css: function() { return wrap; },
            offset: function() { if(!els[0])return null; var r=els[0].getBoundingClientRect(); return {left:r.left+window.scrollX, top:r.top+window.scrollY}; },
            get: function(i) { return els[i]; },
            addClass: function(c) { for(var i=0;i<els.length;i++)els[i].classList.add(c); return wrap; },
            hasClass: function(c) { return els[0]?els[0].classList.contains(c):false; },
            _set: function(el) { els=el?[el]:[]; wrap.length=els.length; wrap[0]=els[0]; return wrap; }
        };
        return wrap;
    }
    function emptySet() {
        return {length:0,find:function(){return emptySet();},each:function(){return emptySet();},eq:function(){return emptySet();},
            text:function(){return'';},val:function(){return'';},attr:function(){return'';},is:function(){return false;},
            css:function(){return emptySet();},offset:function(){return null;},get:function(){return null;},
            addClass:function(){return emptySet();},hasClass:function(){return false;}};
    }
    function singleSet(el) {
        if (!el) return emptySet();
        var w = {length:1,0:el};
        w.find = function(s){return $(s,el);};
        w.each = function(fn){fn.call(el,0,el);return w;};
        w.eq = function(i){return i===0?w:emptySet();};
        w.text = function(){return el.textContent||'';};
        w.val = function(v){if(v!==undefined){el.value=v;return w;}return el.value||'';};
        w.attr = function(a){return el.getAttribute(a)||'';};
        w.is = function(s){return el.matches(s);};
        w.css = function(){return w;};
        w.offset = function(){var r=el.getBoundingClientRect();return {left:r.left+window.scrollX,top:r.top+window.scrollY};};
        w.get = function(){return el;};
        w.addClass = function(c){el.classList.add(c);return w;};
        w.hasClass = function(c){return el.classList.contains(c);};
        return w;
    }

    // ═══════════ CONFIG (boolean-safe storage) ═══════════
    function gv(k, d) { var v = GM_getValue(k); return v === undefined ? d : v; }
    function sv(k, v) { GM_setValue(k, v); }

    var C = {
        apiKey: gv('ds_apikey9', ''),
        model: gv('ds_model9', 'deepseek-chat'),
        interval: parseInt(gv('ds_iv9', '3000')),
        autoSubmit: parseInt(gv('ds_sub9', '0')),
        redo: Boolean(gv('ds_redo9', false)),
        alterTitle: Boolean(gv('ds_alter9', true)),
        doVideo: Boolean(gv('ds_vid9', true)),
        doAudio: Boolean(gv('ds_aud9', true)),
        doQuiz: Boolean(gv('ds_quiz9', true)),
        doPPT: Boolean(gv('ds_ppt9', true))
    };
    var speed = parseFloat(gv('ds_spd9', '1.0'));
    var cache = {};
    try { cache = JSON.parse(gv('ds_cache9', '{}')); } catch(e) {}

    function sc() {
        sv('ds_apikey9', C.apiKey); sv('ds_model9', C.model); sv('ds_iv9', C.interval);
        sv('ds_sub9', C.autoSubmit); sv('ds_redo9', C.redo);
        sv('ds_alter9', C.alterTitle); sv('ds_vid9', C.doVideo); sv('ds_aud9', C.doAudio);
        sv('ds_quiz9', C.doQuiz); sv('ds_ppt9', C.doPPT); sv('ds_spd9', speed);
    }
    function scache() { try { sv('ds_cache9', JSON.stringify(cache)); } catch(e) {} }

    // ═══════════ STATE ═══════════
    var tab = 'answer';
    var answering = false, answerPaused = false, studying = false;
    var aTimer = null, sTimer = null;
    var mode = 'auto';
    var results = [];
    var totalQ = 0, answeredQ = 0;

    // ═══════════ MODERN UI STYLES — Indigo-Blue Glassmorphism ═══════════
    GM_addStyle([
        // ── Panel container ──
        '#ds-p{position:fixed;top:60px;left:50%;z-index:2147483647;width:400px;',
          'font:13px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;',
          'color:#2d3039;background:rgba(255,255,255,0.88);backdrop-filter:blur(32px) saturate(180%);',
          '-webkit-backdrop-filter:blur(32px) saturate(180%);',
          'border:1px solid rgba(255,255,255,0.6);border-radius:18px;',
          'box-shadow:0 8px 48px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.03),0 0 80px rgba(79,110,247,0.06);',
          'overflow:hidden;user-select:none;display:flex;flex-direction:column;',
          'animation:ds-slideIn .35s cubic-bezier(.22,.61,.36,1);}',
        '@keyframes ds-slideIn{from{opacity:0;transform:translateY(-12px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}',
        '#ds-p.ds-hide{display:none !important;}',
        '#ds-p.ds-collapsed #ds-body,#ds-p.ds-collapsed #ds-tabs,#ds-p.ds-collapsed #ds-ft{display:none;}',
        '#ds-p.ds-collapsed{border-radius:18px;}',
        // ── Header ──
        '#ds-h{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;',
          'background:linear-gradient(135deg,#4f6ef7 0%,#6366f1 50%,#7c3aed 100%);',
          'color:#fff;font-weight:600;font-size:13.5px;cursor:grab;flex-shrink:0;position:relative;overflow:hidden;}',
        '#ds-h::before{content:"";position:absolute;top:-40px;right:-30px;width:100px;height:100px;',
          'background:rgba(255,255,255,0.08);border-radius:50%;pointer-events:none;}',
        '#ds-h::after{content:"";position:absolute;bottom:-30px;left:40%;width:60px;height:60px;',
          'background:rgba(255,255,255,0.05);border-radius:50%;pointer-events:none;}',
        '#ds-h:active{cursor:grabbing;}',
        '#ds-h .ds-brand{display:flex;align-items:center;gap:9px;position:relative;z-index:1;}',
        '#ds-h .ds-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.6);flex-shrink:0;',
          'box-shadow:0 0 6px rgba(255,255,255,0.3);transition:all .3s;}',
        '#ds-h .ds-dot.on{background:#4ade80;box-shadow:0 0 10px rgba(74,222,128,0.5);',
          'animation:ds-pulse 2s ease-in-out infinite;}',
        '@keyframes ds-pulse{0%,100%{opacity:1;box-shadow:0 0 6px rgba(74,222,128,0.3)}50%{opacity:.5;box-shadow:0 0 16px rgba(74,222,128,0.7)}}',
        '#ds-h .ds-hb{display:flex;gap:5px;position:relative;z-index:1;}',
        '#ds-h .ds-hb button{width:26px;height:26px;border:1px solid rgba(255,255,255,0.2);',
          'background:rgba(255,255,255,0.1);color:#fff;border-radius:8px;cursor:pointer;',
          'font-size:13px;display:flex;align-items:center;justify-content:center;',
          'transition:all .2s cubic-bezier(.22,.61,.36,1);}',
        '#ds-h .ds-hb button:hover{background:rgba(255,255,255,0.22);border-color:rgba(255,255,255,0.35);',
          'transform:scale(1.05);}',
        '#ds-h .ds-hb button:active{transform:scale(.92);}',
        // ── Tabs ──
        '#ds-tabs{display:flex;border-bottom:1px solid #eef0f5;flex-shrink:0;padding:0 8px;',
          'background:rgba(255,255,255,0.5);}',
        '#ds-tabs button{flex:1;padding:11px 4px;border:none;background:transparent;cursor:pointer;',
          'font-size:13px;font-weight:600;color:#9ca3af;transition:all .25s cubic-bezier(.22,.61,.36,1);',
          'position:relative;letter-spacing:.2px;}',
        '#ds-tabs button:hover{color:#4b5563;}',
        '#ds-tabs button.on{color:#4f6ef7;}',
        '#ds-tabs button.on::after{content:"";position:absolute;bottom:-1px;left:20%;right:20%;',
          'height:2.5px;background:linear-gradient(90deg,#4f6ef7,#6366f1);',
          'border-radius:3px 3px 0 0;transition:all .25s;}',
        // ── Body ──
        '#ds-body{padding:12px 16px;overflow-y:auto;flex:1;max-height:440px;',
          'scroll-behavior:smooth;}',
        '#ds-body::-webkit-scrollbar{width:4px;}',
        '#ds-body::-webkit-scrollbar-track{background:transparent;}',
        '#ds-body::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:10px;}',
        '#ds-body::-webkit-scrollbar-thumb:hover{background:#9ca3af;}',
        '#ds-body input[type="password"],#ds-body select{width:100%;padding:9px 12px;',
          'border:1.5px solid #e5e7eb;border-radius:10px;font-size:13px;margin-bottom:8px;',
          'box-sizing:border-box;background:#f9fafb;color:#1f2937;',
          'transition:all .2s;outline:none;}',
        '#ds-body input:focus,#ds-body select:focus{border-color:#4f6ef7;',
          'box-shadow:0 0 0 3px rgba(79,110,247,0.08);background:#fff;}',
        // ── Log console ──
        '#ds-log{background:#1e1f2b;border-radius:12px;padding:10px 12px;max-height:90px;',
          'overflow-y:auto;font:10.5px "JetBrains Mono","SF Mono","Cascadia Code",monospace;',
          'line-height:1.6;color:#c9cdd7;margin-bottom:8px;min-height:22px;',
          'border:1px solid rgba(0,0,0,0.06);}',
        '#ds-log::-webkit-scrollbar{width:3px;}',
        '#ds-log::-webkit-scrollbar-thumb{background:#4b5563;border-radius:10px;}',
        '#ds-log:empty::after{content:"等待操作…";color:#6b7280;font-style:italic;}',
        '#ds-log .t{color:#6b7280;margin-right:4px;}#ds-log .s{color:#4ade80;}',
        '#ds-log .e{color:#f87171;}#ds-log .w{color:#fbbf24;}#ds-log .i{color:#9ca3af;}#ds-log .p{color:#818cf8;}',
        // ── Buttons ──
        '.ds-row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;}',
        '.ds-row button{flex:1;min-width:50px;padding:10px 8px;border:none;border-radius:12px;',
          'cursor:pointer;font-size:12.5px;font-weight:600;transition:all .2s cubic-bezier(.22,.61,.36,1);',
          'letter-spacing:.2px;position:relative;overflow:hidden;}',
        '.ds-row button:active{transform:scale(.96);}',
        '.ds-go{background:linear-gradient(135deg,#4f6ef7,#6366f1);color:#fff;',
          'box-shadow:0 2px 8px rgba(79,110,247,0.2);}',
        '.ds-go:hover{box-shadow:0 4px 16px rgba(79,110,247,0.35);transform:translateY(-1px);}',
        '.ds-study{background:linear-gradient(135deg,#1e1f2b,#2d3039);color:#f9fafb;',
          'box-shadow:0 2px 8px rgba(0,0,0,0.15);}',
        '.ds-study:hover{box-shadow:0 4px 16px rgba(0,0,0,0.25);transform:translateY(-1px);}',
        '.ds-stop{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;',
          'box-shadow:0 2px 8px rgba(239,68,68,0.2);}',
        '.ds-stop:hover{box-shadow:0 4px 16px rgba(239,68,68,0.3);}',
        '.ds-save{background:#f3f4f6;color:#1f2937;border:1.5px solid #e5e7eb !important;',
          'border-radius:10px !important;width:100%;padding:10px !important;}',
        '.ds-save:hover{background:#e5e7eb;border-color:#d1d5db !important;}',
        // ── Speed buttons ──
        '.ds-spd{display:none;gap:6px;margin-bottom:8px;}',
        '.ds-spd button{flex:1;padding:6px;border:1.5px solid #e5e7eb;border-radius:10px;',
          'background:#f9fafb;cursor:pointer;font-size:11.5px;font-weight:600;color:#6b7280;',
          'transition:all .2s;}',
        '.ds-spd button:hover{border-color:#4f6ef7;color:#4f6ef7;}',
        '.ds-spd button.on{background:linear-gradient(135deg,#4f6ef7,#6366f1);color:#fff;border-color:transparent;}',
        // ── Misc ──
        '.ds-sep{height:1px;background:linear-gradient(90deg,transparent,#e5e7eb 20%,#e5e7eb 80%,transparent);margin:10px 0;}',
        '.ds-lab{font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;',
          'letter-spacing:1.5px;margin-bottom:6px;}',
        '.ds-tgl{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#4b5563;padding:3px 0;}',
        '.ds-tgl label{display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;}',
        '.ds-tgl input[type="checkbox"]{accent-color:#4f6ef7;width:auto;margin:0;transform:scale(1.05);}',
        '.ds-tab-pane{display:none;animation:ds-fadeIn .2s ease;}.ds-tab-pane.on{display:block;}',
        '@keyframes ds-fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
        // ── Footer ──
        '#ds-ft{text-align:center;padding:7px 14px;font-size:10px;color:#9ca3af;',
          'border-top:1px solid #f3f4f6;flex-shrink:0;font-weight:500;letter-spacing:.2px;}',
        // ── Mode label ──
        '.ds-mode{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:600;',
          'margin-left:6px;letter-spacing:.3px;}',
        '.ds-mode.m-auto{background:rgba(156,163,175,.12);color:#6b7280;}',
        '.ds-mode.m-work{background:rgba(79,110,247,.1);color:#4f6ef7;}',
        '.ds-mode.m-exam{background:rgba(239,68,68,.08);color:#ef4444;}',
        // ── Results list ──
        '#ds-results{margin-top:10px;}',
        '#ds-res-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}',
        '#ds-res-header .ds-lab{margin-bottom:0;}',
        '#ds-res-header .ds-res-count{font-size:10.5px;color:#9ca3af;font-weight:700;}',
        '#ds-res-list{max-height:260px;overflow-y:auto;}',
        '#ds-res-list::-webkit-scrollbar{width:4px;}#ds-res-list::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:10px;}',
        '#ds-res-list .r-item{background:#fff;border:1px solid #eef0f5;border-radius:12px;',
          'padding:11px 13px;margin-bottom:7px;transition:all .2s cubic-bezier(.22,.61,.36,1);',
          'position:relative;overflow:hidden;}',
        '#ds-res-list .r-item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;',
          'background:linear-gradient(180deg,#4f6ef7,#6366f1);border-radius:0 3px 3px 0;opacity:0;',
          'transition:opacity .2s;}',
        '#ds-res-list .r-item:hover{border-color:#d1d5db;box-shadow:0 2px 12px rgba(0,0,0,0.04);',
          'transform:translateY(-1px);}',
        '#ds-res-list .r-item:hover::before{opacity:1;}',
        '#ds-res-list .r-item .r-num{font-size:10.5px;font-weight:700;color:#9ca3af;',
          'text-transform:uppercase;letter-spacing:.5px;}',
        '#ds-res-list .r-item .r-type{font-size:10px;font-weight:600;padding:2px 8px;',
          'border-radius:12px;display:inline-block;margin-left:6px;}',
        '#ds-res-list .r-item .r-type.t-single{background:#ede9fe;color:#7c3aed;}',
        '#ds-res-list .r-item .r-type.t-multiple{background:#dbeafe;color:#2563eb;}',
        '#ds-res-list .r-item .r-type.t-judgement{background:#fce7f3;color:#db2777;}',
        '#ds-res-list .r-item .r-type.t-completion{background:#fef3c7;color:#d97706;}',
        '#ds-res-list .r-item .r-q{font-size:12px;color:#1f2937;margin:6px 0;line-height:1.5;',
          'padding-right:52px;}',
        '#ds-res-list .r-item .r-a{font-size:12.5px;font-weight:700;color:#4f6ef7;}',
        '#ds-res-list .r-item .r-a span{background:#eef2ff;padding:3px 10px;border-radius:6px;}',
        '#ds-res-list .r-item .r-copy{position:absolute;top:10px;right:12px;',
          'padding:4px 12px;border:1.5px solid #e5e7eb;border-radius:8px;background:#fff;',
          'cursor:pointer;font-size:11px;font-weight:600;color:#6b7280;',
          'transition:all .2s cubic-bezier(.22,.61,.36,1);}',
        '#ds-res-list .r-item .r-copy:hover{border-color:#4f6ef7;color:#4f6ef7;',
          'background:#eef2ff;box-shadow:0 2px 8px rgba(79,110,247,0.1);}',
        '#ds-res-list .r-empty{text-align:center;color:#9ca3af;font-size:12px;padding:24px 0;}',
        '#ds-res-list .r-status{font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px;',
          'display:inline-block;margin-left:6px;}',
        '#ds-res-list .r-status.s-ok{background:rgba(74,222,128,.1);color:#16a34a;}',
        '#ds-res-list .r-status.s-marked{background:rgba(251,191,36,.1);color:#d97706;}',
        '#ds-res-list .r-status.s-skipped{background:rgba(156,163,175,.1);color:#6b7280;}',
        '#ds-res-list .r-status.s-error{background:rgba(248,113,113,.1);color:#dc2626;}',
        // ── On-page answer badges ──
        '.ds-answer-badge{display:inline-block;padding:3px 10px;margin-left:6px;',
          'background:linear-gradient(135deg,#4f6ef7,#6366f1);color:#fff;font-size:11px;',
          'font-weight:700;border-radius:12px;vertical-align:middle;letter-spacing:.3px;',
          'box-shadow:0 2px 6px rgba(79,110,247,0.2);animation:ds-badgePop .3s ease;}',
        '@keyframes ds-badgePop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}',
        // ── Toast ──
        '.ds-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:2147483648;',
          'padding:10px 24px;background:linear-gradient(135deg,#1e1f2b,#2d3039);color:#f9fafb;',
          'border-radius:24px;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;',
          'font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.2);pointer-events:none;',
          'animation:ds-toastIn .3s ease;}',
        '@keyframes ds-toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}',
          'to{opacity:1;transform:translateX(-50%) translateY(0)}}'
    ].join('\n'));

    // ═══════════ UTILS ═══════════
    function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
    function now() { return Date.now(); }

    function log(m, c) {
        c = c || 'i';
        var b = document.getElementById('ds-log'); if (!b) return;
        var t = new Date().toLocaleTimeString('zh-CN', {hour12:false});
        var d = document.createElement('div');
        d.innerHTML = '<span class="t">['+t+']</span> <span class="'+c+'">'+m+'</span>';
        b.insertBefore(d, b.firstChild);
        while (b.children.length > 60) b.removeChild(b.lastChild);
    }

    function toast(msg, d) {
        d = d || 2500;
        var el = document.createElement('div');
        el.className = 'ds-toast';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s ease'; setTimeout(function(){ if(el.parentNode)el.parentNode.removeChild(el); },300); }, d);
    }

    function clickIt(el) {
        if (!el) return false;
        try { el.click(); return true; } catch(e) {
            try { var ev = new MouseEvent('click',{bubbles:true,cancelable:true}); el.dispatchEvent(ev); return true; } catch(e2) {}
        }
        return false;
    }

    function clean(s) { if (!s) return ''; return s.replace(/<img[^>]*alt\s*=\s*"([^"]*)"[^>]*>/gi, '[图片:$1]').replace(/<img[^>]*>/gi, '[图片]').replace(/<(?!img)[^>]*>/g,'').replace(/&nbsp;/g,'').replace(/^\s+|\s+$/g,'').trim(); }
    function cleanQ(s) { if (!s) return ''; return s.replace(/<img[^>]*alt\s*=\s*"([^"]*)"[^>]*>/gi, '[图片:$1]').replace(/<img[^>]*>/gi, '[图片]').replace(/<(?!img)[^>]*>/g,'').replace(/^\d+[.、]/,'').replace(/^【.*?】\s*/,'').replace(/\s*（\d+\.?\d*分）$/,'').trim(); }
    function hashQ(q, opts) { var s=(q||'')+'|'; if(opts)s+=opts.join(','); var h=0; for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;} return 'q_'+h; }

    function escHtml(s) { if(!s)return''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function copyToClipboard(text) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
            toast('已复制到剪贴板', 1500);
        } catch(e) {
            try { navigator.clipboard.writeText(text); toast('已复制', 1500); } catch(e2) { toast('复制失败', 2000); }
        }
    }

    // ═══════════ QUESTION TYPE (OCS exact) ═══════════
    function getQuestionType(val) {
        var n = parseInt(val);
        if (n === 0) return 'single';
        if (n === 1) return 'multiple';
        if (n === 3) return 'judgement';
        if ([2,4,5,6,7,8,9,10].indexOf(n) !== -1) return 'completion';
        if (n === 11) return 'line';
        if (n === 14) return 'fill';
        if (n === 15) return 'reader';
        return null;
    }

    // ═══════════ PAGE MODE DETECTION ═══════════
    function detectMode() {
        var path = _l.pathname, href = _l.href;
        if (/\/mooc2\/work\/dowork|\/mooc-ans\/mooc2\/work\/dowork/.test(path)) return 'homework';
        if (/\/work\/doHomeWorkNew|\/mooc-ans\/work\/doHomeWorkNew/.test(path)) return 'chapterTest';
        if ((/\/exam\/test\/reVersionTestStartNew|\/exam-ans\/exam\/test\/reVersionTestStartNew/.test(path)) && !href.includes('newMooc=true')) return 'oldExam';
        if (((/\/exam\/test\/reVersionTestStartNew|\/exam-ans\/exam\/test\/reVersionTestStartNew|\/mooc-ans\/exam\/test\/reVersionTestStartNew/.test(path)) && href.includes('newMooc=true')) ||
            /\/mooc2\/exam\/preview|\/exam-ans\/mooc2\/exam\/preview|\/mooc-ans\/mooc2\/exam\/preview/.test(path)) return 'newExam';
        if (/\/knowledge\/cards/.test(path)) return 'inClassQuiz';
        return 'homework';
    }

    function getModeConfig(m) {
        switch(m) {
            case 'homework':
                return {
                    root: '.questionLi',
                    titleSel: '.mark_name, h3, .Zy_TItle, .splitS-left .mark_name, .line_wid_half',
                    optTextSel: '.stem_answer .answerBg .answer_p, .textDIV, .eidtDiv',
                    optClickSel: '.stem_answer .answerBg, .textDIV, .eidtDiv',
                    typeSel: 'input[id^="answertype"]',
                    // 万能 pattern: check ROOT for any check_answer class
                    rootHasCheck: '.check_answer, .check_answer_dx',
                    pagination: 'both' // all visible + next button
                };
            case 'oldExam':
                return {
                    root: '.TiMu',
                    titleSel: '.Cy_TItle .clearfix, .Cy_TItle, .Zy_TItle',
                    optTextSel: '.Cy_ulTop .clearfix',
                    optClickSel: '.Cy_ulTop input[type="radio"], .Cy_ulTop input[type="checkbox"]',
                    typeSel: '[name^=type]:not([id])',
                    rootHasCheck: null, // use input.checked instead
                    pagination: 'self' // _self.getTheNextQuestion(1)
                };
            case 'chapterTest':
                return {
                    root: '.clearfix .TiMu',
                    titleSel: '.Zy_TItle .clearfix, .Zy_TItle',
                    optTextSel: 'ul li .after',
                    optClickSel: 'ul li .num_option, ul li .num_option_dx',
                    typeSel: 'input[name^="answertype"]',
                    rootHasCheck: '.check_answer, .check_answer_dx',
                    pagination: 'dom' // all on page
                };
            case 'newExam':
                return {
                    root: '.questionLi',
                    titleSel: 'h3 div, h3, .mark_name',
                    optTextSel: '.answerBg .answer_p, .textDIV, .eidtDiv',
                    optClickSel: '.answerBg, .textDIV, .eidtDiv',
                    typeSel: 'input[name^="type"]',
                    rootHasCheck: '.check_answer, .check_answer_dx',
                    pagination: 'none' // all visible, no next btn
                };
            default: return getModeConfig('homework');
        }
    }

    // ═══════════ DEEPSEEK API ═══════════
    function askAI(qInfo) {
        return new Promise(function(ok, fail) {
            if (!C.apiKey) { fail(new Error('请先保存API Key')); return; }
            var ck = hashQ(qInfo.question, qInfo.options);
            if (cache[ck]) { log('命中缓存','s'); ok(cache[ck]); return; }
            // Check backend answer capture cache
            var bcAns = checkBackendCache(qInfo.question, qInfo.options);
            if (bcAns) { log('命中后台答案','s'); cache[ck] = bcAns; scache(); ok(bcAns); return; }

            var prompt = '直接给出答案不要解释\n题目：' + qInfo.question + '\n';
            if (qInfo.options && qInfo.options.length > 0 && qInfo.type !== 'completion') {
                prompt += '选项：\n';
                qInfo.options.forEach(function(o,i){ prompt += String.fromCharCode(65+i)+'. '+o.replace(/^[A-Z][\s.、．。]+|^\d+[\s.、．。]+/,'').trim()+'\n'; });
                if (qInfo.type === 'single') prompt += '\n请直接回答选项字母（A/B/C/D/...）';
                else if (qInfo.type === 'multiple') prompt += '\n这是多选题，请列出所有正确选项的字母，逗号分隔（如：A,B,D）';
                else if (qInfo.type === 'judgement') prompt += '\n这是判断题，A表示正确，B表示错误';
                else prompt += '\n请直接回答选项字母';
            } else if (qInfo.type === 'completion') {
                prompt += '\n这是填空题/简答题，请直接给出答案文本';
            } else {
                prompt += '\n请输出为纯文本不要带任何格式';
            }
            log((qInfo.type||'?')+': '+(qInfo.question||'').substring(0,40)+'…','p');

            GM_xmlhttpRequest({
                method:'POST', url:'https://api.deepseek.com/v1/chat/completions',
                headers:{'Content-Type':'application/json','Authorization':'Bearer '+C.apiKey},
                data:JSON.stringify({model:C.model, messages:[{role:'user',content:prompt}], temperature:0.1, max_tokens:4096}),
                timeout:60000,
                onload:function(r){
                    if(r.status>=200&&r.status<300){try{var d=JSON.parse(r.responseText);if(d.choices&&d.choices[0]&&d.choices[0].message){var ans=d.choices[0].message.content.trim();log('→ '+ans.substring(0,60)+(ans.length>60?'…':''),'s');cache[ck]=ans;scache();ok(ans);}else{fail(new Error('API异常'));}}catch(e){fail(e);}}
                    else if(r.status===429)fail(new Error('限流'));else if(r.status===401)fail(new Error('Key无效'));
                    else if(r.status===402)fail(new Error('余额不足'));else fail(new Error('HTTP '+r.status));
                },
                onerror:function(){fail(new Error('网络错误'));}, ontimeout:function(){fail(new Error('超时'));}
            });
        });
    }

    // ═══════════ RESULTS (inline) ═══════════
    function addResult(num, type, question, answer, status) {
        results.push({num:num, type:type, question:question, answer:answer, status:status||'ok'});
        updateResultsUI();
    }
    function clearResults() { results = []; updateResultsUI(); totalQ = 0; answeredQ = 0; }

    function updateResultsUI() {
        var list = document.getElementById('ds-res-list');
        var count = document.getElementById('ds-res-count');
        if (count) count.textContent = answeredQ + '/' + totalQ;
        if (!list) return;
        if (!results.length) { list.innerHTML = '<div class="r-empty">等待答题…</div>'; return; }

        var typeLabels = {single:'单选', multiple:'多选', judgement:'判断', completion:'填空/简答', line:'连线', fill:'填空'};
        var statusLabels = {ok:'已答', marked:'已标记', skipped:'已跳过', error:'错误'};
        list.innerHTML = results.map(function(r, idx) {
            var rid = 'r-' + results.length + '-' + idx;
            var tl = typeLabels[r.type] || r.type;
            var sl = statusLabels[r.status] || r.status;
            return '<div class="r-item" id="'+rid+'">' +
              '<span class="r-num">第'+r.num+'题</span>' +
              '<span class="r-type t-'+r.type+'">'+tl+'</span>' +
              '<span class="r-status s-'+r.status+'">'+sl+'</span>' +
              '<button class="r-copy" data-rid="'+rid+'" title="复制题目去百度搜索">📋 复制</button>' +
              '<div class="r-q">'+escHtml(r.question||'').substring(0,200)+'</div>' +
              '<div class="r-a">答案: <span>'+escHtml(r.answer||'(无)')+'</span></div>' +
            '</div>';
        }).join('');

        list.querySelectorAll('.r-copy').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var item = this.closest('.r-item');
                var q = item.querySelector('.r-q').textContent || '';
                var a = item.querySelector('.r-a span').textContent || '';
                copyToClipboard(q + '\n答案: ' + a);
                var orig = this.textContent;
                this.textContent = '✓ 已复制';
                this.style.color = '#16a34a';
                this.style.borderColor = '#4ade80';
                setTimeout(function(){ btn.textContent = orig; btn.style.color = '#6b7280'; btn.style.borderColor = '#e5e7eb'; }, 1500);
            });
        });
    }

    // ═══════════ ANSWER ENGINE ═══════════
    function isQuestionAnswered(cfg, rootEl) {
        // Fast check: look for check_answer class in the entire root (万能 pattern)
        if (cfg.rootHasCheck && rootEl.querySelector(cfg.rootHasCheck)) return true;
        // Also check for platform answer-finished markers
        if (rootEl.querySelector('.newAnswerBx .myAnswer, .answerScore, .myAllAnswerBx, .answerFont, .mark_answer_dx, .mark_answer')) return true;
        // For oldExam: check if any radio/checkbox is checked
        if (cfg.pagination === 'self') {
            var inputs = rootEl.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
            if (inputs.length > 0) return true;
        }
        return false;
    }

    async function processOneQuestion(cfg, rootEl, index) {
        try {
            // ── Extract title ──
            var qText = '';
            var titleEls = rootEl.querySelectorAll(cfg.titleSel);
            for (var ti=0; ti<titleEls.length; ti++) {
                var t = cleanQ(titleEls[ti].textContent||'').replace(/^\d+[.、]/,'').trim();
                if (t && t.length > 2) { qText = t; break; }
            }
            if (!qText || qText.length < 2) {
                var tc = (rootEl.textContent||'').replace(/\s+/g,' ').trim();
                var optEls = rootEl.querySelectorAll(cfg.optTextSel);
                optEls.forEach(function(o){ tc = tc.replace((o.textContent||'').trim(), ''); });
                qText = tc.substring(0, 500).trim();
            }

            // ── Extract options ──
            var optionTexts = [];
            var optEls = rootEl.querySelectorAll(cfg.optTextSel);
            optEls.forEach(function(el) {
                var t = clean(el.textContent||'').replace(/^[A-Z][\s.、．。]+/,'').trim();
                if (t && t.length < 400) optionTexts.push(t);
            });

            // ── Get type (OCS pattern: find type input with name matching type\d+) ──
            var typeInput = rootEl.querySelector(cfg.typeSel);
            // For newExam, the type selector uses name^=type, try more precise match like OCS
            if (!typeInput && cfg.typeSel.indexOf('name^="type"') !== -1) {
                var allTypeInputs = rootEl.querySelectorAll('input[name^="type"]');
                for (var ti2=0; ti2<allTypeInputs.length; ti2++) {
                    var nm = allTypeInputs[ti2].getAttribute('name') || '';
                    if (/type\d+/.test(nm)) { typeInput = allTypeInputs[ti2]; break; }
                }
            }
            var typeVal = typeInput ? parseInt(typeInput.value) : 0;
            var qType = getQuestionType(typeVal) || 'single';
            if (!typeInput) {
                var tq = qText.substring(0,50);
                if (/多选/.test(tq)) qType = 'multiple';
                else if (/判断/.test(tq)) qType = 'judgement';
                else if (/填空|简答|名词|论述|计算/.test(tq)) qType = 'completion';
            }

            log('['+(index+1)+'] '+qType+': '+qText.substring(0,35)+'…','p');

            // ── Check already answered (fast root-level check) ──
            var alreadyAnswered = isQuestionAnswered(cfg, rootEl);

            if (alreadyAnswered && !C.redo) {
                log('  已作答，跳过','i');
                var existingAns = '';
                rootEl.querySelectorAll('[class*="check_answer"]').forEach(function(c){ existingAns += (c.getAttribute('data')||c.textContent||'').trim() + ' '; });
                if (!existingAns) {
                    rootEl.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(function(c){ existingAns += (c.value||'') + ' '; });
                }
                addResult(index+1, qType, qText, existingAns.trim()||'(已有答案)', 'skipped');
                return {answered:true, type:qType, question:qText};
            }

            // ── Ask AI ──
            var answer = await askAI({type:qType, question:qText, options:optionTexts});
            if (!answer) return null;

            // ── Parse answer letters ──
            var letters = [];
            if (qType === 'single' || qType === 'multiple' || qType === 'judgement') {
                var a = answer.toUpperCase().trim();
                if (qType === 'multiple') {
                    letters = a.split(/[,，、\s]+/).filter(function(l){return /^[A-Z]$/.test(l);});
                    if (!letters.length) { var m1 = a.match(/[A-F]/g); letters = m1 || []; }
                } else if (qType === 'judgement') {
                    if (/^A$|对|正确|√|true/i.test(a)) letters=['A'];
                    else if (/^B$|错|错误|×|false/i.test(a)) letters=['B'];
                    else { var m2 = a.match(/[AB]/i); letters = m2 ? [m2[0].toUpperCase()] : ['A']; }
                } else {
                    var m3 = a.match(/[A-Z]/);
                    if (m3) letters = [m3[0]];
                    else if (/对|正确|√|true/i.test(a)) letters=['A'];
                    else if (/错|错误|×|false/i.test(a)) letters=['B'];
                }
                if (!letters.length) { log('无法解析答案','e'); addResult(index+1, qType, qText, answer.substring(0,100), 'error'); return null; }
            }

            // ── Fill / Mark ──
            if (qType === 'single' || qType === 'multiple' || qType === 'judgement') {

                // ── AlterTitle: inject answer badge into question title ──
                if (C.alterTitle) {
                    // Remove old badge first
                    var oldBadge = rootEl.querySelector('.ds-answer-badge');
                    if (oldBadge) oldBadge.remove();
                    var tlel = rootEl.querySelector(cfg.titleSel);
                    if (tlel) {
                        var badge = document.createElement('span');
                        badge.className = 'ds-answer-badge';
                        badge.textContent = letters.join(',');
                        tlel.appendChild(badge);
                    }
                }

                // ── If redo mode and already answered: clear previous selections first ──
                if (alreadyAnswered && C.redo) {
                    var prevChecked = rootEl.querySelectorAll(cfg.optClickSel);
                    for (var pci = 0; pci < prevChecked.length; pci++) {
                        var pc = prevChecked[pci];
                        var isSel = pc.checked ||
                            (pc.className && (pc.className.indexOf('check_answer')!==-1 || pc.className.indexOf('check_answer_dx')!==-1)) ||
                            (pc.parentElement && pc.parentElement.querySelector('[class*="check_answer"]'));
                        if (isSel) {
                            // Deselect: click to toggle off, then remove check classes
                            clickIt(pc);
                            if (pc.className) {
                                pc.classList.remove('check_answer');
                                pc.classList.remove('check_answer_dx');
                            }
                            // Uncheck inner input
                            var inr = pc.querySelector('input');
                            if (!inr && pc.tagName === 'INPUT') inr = pc;
                            if (inr) { inr.checked = false; inr.dispatchEvent(new Event('change',{bubbles:true})); }
                            // Also remove check classes from parent
                            if (pc.parentElement) {
                                var pck = pc.parentElement.querySelectorAll('[class*="check_answer"]');
                                pck.forEach(function(c){ c.classList.remove('check_answer'); c.classList.remove('check_answer_dx'); });
                            }
                            await sleep(100);
                        }
                    }
                    log('  已清除旧选择，重新作答…','i');
                }

                // ── Click options (pure index-based) ──
                var clickableEls = rootEl.querySelectorAll(cfg.optClickSel);
                for (var li = 0; li < letters.length; li++) {
                    var L = letters[li];
                    var idx = L.charCodeAt(0) - 65;
                    if (idx < 0 || idx >= clickableEls.length) continue;

                    // Skip if this specific option is already checked (and not redo mode)
                    var targetEl = clickableEls[idx];
                    if (!C.redo) {
                        if (targetEl.checked) continue;
                        if (targetEl.className && (targetEl.className.indexOf('check_answer')!==-1 || targetEl.className.indexOf('check_answer_dx')!==-1)) continue;
                        if (targetEl.parentElement && targetEl.parentElement.querySelector('[class*="check_answer"]')) continue;
                    }

                    clickIt(targetEl);
                    var innerInput = targetEl.querySelector('input');
                    if (!innerInput && targetEl.tagName === 'INPUT') innerInput = targetEl;
                    if (innerInput) { innerInput.checked = true; innerInput.dispatchEvent(new Event('change',{bubbles:true})); }
                    if (targetEl.className && (targetEl.className.indexOf('num_option')!==-1)) {
                        targetEl.classList.add(qType==='multiple'?'check_answer_dx':'check_answer');
                    }
                    await sleep(150);
                }
                log('✓ ['+letters.join(',')+']','s');
                addResult(index+1, qType, qText, letters.join(','), 'ok');
                return {type:qType, question:qText, answer:letters.join(','), status:'ok'};

            } else if (qType === 'completion' || qType === 'fill') {
                var filled = false;
                // Textareas
                rootEl.querySelectorAll('textarea').forEach(function(ta) {
                    var name = ta.getAttribute('name') || ta.id;
                    if (name && _UE && _UE.getEditor) {
                        try { _UE.getEditor(name).setContent(answer); filled = true; } catch(e) {}
                    }
                    ta.value = answer; ta.dispatchEvent(new Event('input',{bubbles:true})); filled = true;
                });
                // Inputs
                rootEl.querySelectorAll('input[type="text"]:not([disabled])').forEach(function(inp) {
                    inp.value = answer; inp.dispatchEvent(new Event('input',{bubbles:true})); filled = true;
                });
                // UEditor iframes
                if (!filled) {
                    rootEl.querySelectorAll('iframe[id^="ueditor_"]').forEach(function(ifr) {
                        try { var d=ifr.contentDocument||ifr.contentWindow.document; if(d&&d.body){d.body.innerHTML=answer;filled=true;} } catch(e) {}
                    });
                }
                // Contenteditable
                if (!filled) {
                    var ce = rootEl.querySelector('[contenteditable="true"]');
                    if (ce) { ce.innerHTML = answer; ce.dispatchEvent(new Event('input',{bubbles:true})); filled = true; }
                }
                // Click save button
                var saveBtn = rootEl.querySelector('[onclick*=saveQuestion]') || rootEl.parentElement && rootEl.parentElement.querySelector('[onclick*=saveQuestion]');
                if (saveBtn) { clickIt(saveBtn); }
                log('✓','s');
                addResult(index+1, qType, qText, answer.substring(0,200), filled?'ok':'error');
                return {type:qType, question:qText, answer:answer.substring(0,200), status:filled?'ok':'error'};
            }
            addResult(index+1, qType, qText, answer.substring(0,200), 'ok');
            return {type:qType, question:qText, answer:answer.substring(0,200), status:'ok'};
        } catch(e) {
            log('错误: '+e.message,'e');
            return null;
        }
    }

    // ═══════════ FIND ROOTS (including iframes) ═══════════
    function findRoots(cfg) {
        var roots = document.querySelectorAll(cfg.root);
        if (!roots.length) {
            document.querySelectorAll('iframe').forEach(function(ifr) {
                try { var d=ifr.contentDocument||ifr.contentWindow.document; var rts=d.querySelectorAll(cfg.root); if(rts.length){roots=rts;} } catch(e) {}
            });
        }
        return roots;
    }

    // ═══════════ ANSWER LOOP ═══════════
    function startAnswer() {
        if (!C.apiKey) { log('请先保存API Key!','e'); return; }
        if (answering) { log('答题已在运行','i'); return; }
        answering = true; answerPaused = false;
        mode = detectMode();
        clearResults();
        var cfg = getModeConfig(mode);
        var roots = findRoots(cfg);
        totalQ = roots.length;
        answeredQ = 0;
        updateResultsUI();
        updateAnswerUI();
        log('▶ 模式: '+mode+' | 检测到 '+totalQ+' 题','s');
        updateModeLabel(mode);

        if (mode === 'oldExam') {
            paginatedAnswer();
        } else {
            // For homework: try all visible roots first, then check next button
            answerAllVisible(0, Array.from(roots), cfg);
        }
    }
    function stopAnswer() { answering = false; if (aTimer) clearTimeout(aTimer); updateAnswerUI(); log('⏹ 已停止','w'); }

    // Process all visible questions, THEN check for next button
    async function answerAllVisible(i, qs, cfg) {
        if (!answering) return;
        if (answerPaused) { aTimer = setTimeout(function(){answerAllVisible(i,qs,cfg);},3000); return; }

        if (i >= qs.length) {
            // All visible questions done — check if there's a next button
            var nextBtn = document.querySelector('[onclick="getTheNextQuestion(1)"]');
            if (nextBtn && nextBtn.offsetParent && nextBtn.style.display !== 'none') {
                log('点击下一题…','i');
                clickIt(nextBtn);
                aTimer = setTimeout(function() {
                    var newCfg = getModeConfig(mode);
                    var newRoots = findRoots(newCfg);
                    if (newRoots.length) {
                        totalQ += newRoots.length;
                        answerAllVisible(0, Array.from(newRoots), newCfg);
                    } else {
                        finishAnswer();
                    }
                }, C.interval + 2000);
            } else {
                finishAnswer();
            }
            return;
        }

        var result = await processOneQuestion(cfg, qs[i], i);
        if (result && !result.answered) { answeredQ++; totalQ = Math.max(totalQ, i+1); }
        updateResultsUI();

        aTimer = setTimeout(function(){answerAllVisible(i+1,qs,cfg);}, 600);
    }

    function finishAnswer() {
        log('全部完成! ('+answeredQ+'/'+totalQ+')','s');
        if (C.autoSubmit>=1) autoSubmit();
        answering = false; updateAnswerUI();
    }

    var pagCount = 0;
    async function paginatedAnswer() {
        if (!answering) return;
        if (answerPaused) { aTimer = setTimeout(paginatedAnswer, 3000); return; }
        if (pagCount > 200) { log('达到上限','w'); answering=false; updateAnswerUI(); return; }

        var cfg = getModeConfig(mode);
        var root = document.querySelector(cfg.root);
        if (!root) {
            document.querySelectorAll('iframe').forEach(function(ifr) {
                try { var d=ifr.contentDocument||ifr.contentWindow.document; var r=d.querySelector(cfg.root); if(r)root=r; } catch(e) {}
            });
            if (!root) { log('无题目','w'); answering=false; updateAnswerUI(); return; }
        }

        var result = await processOneQuestion(cfg, root, pagCount);
        if (result && !result.answered) { answeredQ++; totalQ = Math.max(totalQ, pagCount+1); }
        updateResultsUI();
        pagCount++;

        await sleep(800);
        try { _w._self.getTheNextQuestion(1); } catch(e) { log('翻页失败: '+e.message,'e'); }
        aTimer = setTimeout(paginatedAnswer, C.interval + 2000);
    }

    function autoSubmit() {
        log('尝试提交…','i');
        setTimeout(function(){
            document.querySelectorAll('button,.btn_blue,.submit-btn,.Btn_blue_1,.sub_btn,.saveYl').forEach(function(b){
                if(/提交|交卷/.test(b.textContent||'')){clickIt(b);log('已点击提交','s');}
            });
            setTimeout(function(){ var o=document.querySelector('#okBtn,.layui-layer-btn0,.confirm-btn'); if(o)clickIt(o); },2000);
        },2000);
    }

    // ═══════════ STUDY ENGINE ═══════════
    function findCardsDoc(){if(_l.pathname.indexOf('/knowledge/cards')!==-1)return document;var r=null;function scan(d){if(r)return;try{if(d.location.pathname.indexOf('/knowledge/cards')!==-1){r=d;return;}}catch(e){}try{d.querySelectorAll('iframe').forEach(function(f){try{scan(f.contentDocument||f.contentWindow.document);}catch(e){}});}catch(e){}}scan(document);return r;}
    var sTaskQ=[], sProcessing=false, sSkipPend=false, sSkipTimer=null, sLastNav=0;

    function startStudy(){
        if(!C.apiKey){log('请先保存API Key!','e');return;}
        if(studying){log('刷课已在运行','i');return;}
        studying=true;sProcessing=false;sTaskQ=[];updateStudyUI();log('🎬 开始刷课…','s');
        setTimeout(function(){if(!studying)return;function tri(){if(!studying||sProcessing)return;var cd=findCardsDoc();if(cd)initSTasks(cd);else log('请在课程章节页面使用','w');}tri();if(sTimer)clearInterval(sTimer);sTimer=setInterval(function(){if(!studying){clearInterval(sTimer);sTimer=null;return;}if(sProcessing)return;var cd=findCardsDoc();if(cd&&!sTaskQ.length)initSTasks(cd);},5000);},3000);
    }
    function stopStudy(){studying=false;sProcessing=false;sTaskQ=[];if(sTimer){clearInterval(sTimer);sTimer=null;}if(sSkipTimer){clearTimeout(sSkipTimer);sSkipTimer=null;}updateStudyUI();log('刷课已停止','w');}
    function initSTasks(doc){if(!studying)return;sProcessing=true;sTaskQ=[];var tasks=doc.querySelectorAll('.ans-attach-ct:not(.ans-job-finished),.ans-job-ct:not(.ans-job-finished)');if(!tasks.length){var anyT=doc.querySelectorAll('.ans-attach-ct,.ans-job-ct');if(anyT.length){log('任务已完成，跳转','s');schedSkip(2000);}sProcessing=false;return;}for(var i=0;i<tasks.length;i++){var ifm=tasks[i].querySelector('iframe'),ifd=null;try{if(ifm)ifd=ifm.contentDocument||ifm.contentWindow.document;}catch(e){}sTaskQ.push({el:tasks[i],doc:ifd||doc,ifm:ifm});}log('发现 '+sTaskQ.length+' 个任务','i');sProcNext();}
    function sProcNext(){if(!studying){sProcessing=false;return;}if(!sTaskQ.length){log('本章完成','s');sProcessing=false;schedSkip(3000);return;}var t=sTaskQ.shift();var src='';try{if(t.ifm)src=t.ifm.getAttribute('src')||'';}catch(e){}try{if(!t.doc&&t.ifm)t.doc=t.ifm.contentDocument||t.ifm.contentWindow.document;}catch(e){}
        // OCS-style: detect task type by looking INSIDE the iframe DOM first, then fallback to src URL
        var taskType = 'unknown';
        if (t.doc) {
            try {
                if (t.doc.querySelector('#video,#audio,video,audio')) taskType = 'media';
                else if (t.doc.querySelector('.TiMu,.questionLi')) taskType = 'quiz';
                else if (t.doc.querySelector('#img.imglook,.swiper-container,#readArea,.readArea,.docBox,.pptBox')) taskType = 'ppt';
                else if (t.doc.querySelector('iframe[name="bookifame"][src*="timing"]')) taskType = 'ppt';
                else if (t.doc.querySelector('#hyperlink')) taskType = 'link';
            } catch(e) {}
        }
        // Fallback: src URL pattern matching
        if (taskType === 'unknown') {
            if (/video|\.mp4|audio|\.mp3/.test(src)) taskType = 'media';
            else if (/pdf|ppt|document|timing/.test(src)) taskType = 'ppt';
            else if (/work|exam|test|quiz/.test(src)) taskType = 'quiz';
        }
        // Dispatch
        if (taskType === 'media' && (C.doVideo || C.doAudio)) sHandleVideo(t.doc);
        else if (taskType === 'ppt' && C.doPPT) sHandlePPT(t.doc);
        else if (taskType === 'quiz' && C.doQuiz) sHandleQuiz(t.doc);
        else { log('未知任务类型 ('+taskType+'), 尝试视频','i'); sHandleVideo(t.doc); }
        setTimeout(function(){try{t.el.classList.add('ans-job-finished');}catch(e){}setTimeout(sProcNext,1500);},10000+Math.floor(Math.random()*4000));
    }
    function sHandleVideo(doc){log('🎬 处理视频…','i');var t=0;function f(){if(!studying)return;var v=doc.querySelector('video');if(!v){var ifs=doc.querySelectorAll('iframe');for(var i=0;i<ifs.length;i++){try{var id=ifs[i].contentDocument||ifs[i].contentWindow.document;v=id.querySelector('video');if(v)break;}catch(e){}}}if(!v){if(++t<20){setTimeout(f,1500);}return;}try{v.scrollIntoView({block:'center'});}catch(e){}v.muted=true;try{v.playbackRate=Math.min(speed,2.0);}catch(e){}try{v.play();}catch(e){}v.addEventListener('pause',function(){if(!v.ended)try{v.play();}catch(e){}});v.addEventListener('ended',function(){log('视频 ✓','s');});}setTimeout(f,1000);}
    function sHandlePPT(doc){log('📄 处理PPT（强制完成）…','i');
        // Strategy 1: scroll to bottom immediately
        try {
            var se = doc.documentElement;
            var cs = ['#readArea','.readArea','.docBox','.pptBox','.reader-container','#img.imglook'];
            for (var ci=0;ci<cs.length;ci++){var c=doc.querySelector(cs[ci]);if(c&&c.scrollHeight>c.clientHeight){se=c;break;}}
            se.scrollTo(0, se.scrollHeight);
            se.dispatchEvent(new Event('scroll',{bubbles:true}));
            doc.documentElement.scrollTo(0, doc.documentElement.scrollHeight);
        } catch(e) {}
        // Strategy 2: try to mark attachment as passed via parent window
        setTimeout(function(){
            try {
                var topWin = _w;
                // Find the iframe's jobid from its data attribute
                var iframes = doc.querySelectorAll('iframe');
                iframes.forEach(function(ifr){
                    try {
                        var dataStr = ifr.getAttribute('data') || '';
                        if (!dataStr) return;
                        var data = JSON.parse(dataStr);
                        var jobid = data.jobid || data._jobid;
                        if (!jobid) return;
                        if (topWin.attachments) {
                            topWin.attachments.forEach(function(att){
                                var aj = att.jobid || (att.property && att.property._jobid);
                                if (String(aj) === String(jobid) && !att.isPassed) {
                                    att.isPassed = true;
                                    if (att.job !== undefined) att.job = false;
                                    log('PPT 后台标记: '+jobid+' ✓','s');
                                }
                            });
                        }
                    } catch(e2) {}
                });
                // Also try to call global completion functions
                if (topWin._jobFinish) {
                    try { topWin._jobFinish(); } catch(e2) {}
                }
                if (topWin.submitJob) {
                    try { topWin.submitJob(); } catch(e2) {}
                }
                // Try clicking #prevNextFocusNext on parent to advance
                var nextBtn = topWin.document && topWin.document.querySelector('#prevNextFocusNext');
                if (nextBtn) { clickIt(nextBtn); log('PPT 尝试跳转下一节','i'); }
            } catch(e) {}
        }, 3000);
        // Keep scrolling for a bit as fallback
        var times = 0;
        var iv = setInterval(function(){
            if(!studying||times>=8){clearInterval(iv);log('PPT 超时完成 ✓','s');return;}
            try {
                se.scrollTo(0, se.scrollHeight);
                se.dispatchEvent(new Event('scroll',{bubbles:true}));
            } catch(e) {}
            times++;
        }, 2000);
    }
    function sHandleQuiz(doc){log('📝 检测到测验，查找题目…','i');
        setTimeout(function() {
            // OCS-style: try .TiMu first (OCS uses this for detection), then fallback to others
            var rootSelectors = ['.TiMu', '.questionLi', '.clearfix .TiMu'];
            var roots = null;
            for (var si = 0; si < rootSelectors.length; si++) {
                roots = doc.querySelectorAll(rootSelectors[si]);
                if (roots.length) break;
            }
            // Also search nested iframes (common for quiz-in-iframe inside study)
            if (!roots || !roots.length) {
                doc.querySelectorAll('iframe').forEach(function(ifr) {
                    if (roots && roots.length) return;
                    try {
                        var idoc = ifr.contentDocument || ifr.contentWindow.document;
                        for (var si = 0; si < rootSelectors.length; si++) {
                            var rts = idoc.querySelectorAll(rootSelectors[si]);
                            if (rts.length) { roots = rts; doc = idoc; break; }
                        }
                    } catch(e) {}
                });
            }
            if (!roots || !roots.length) {
                log('测验无题目 (试过: '+rootSelectors.join(',')+')','w');
                return;
            }
            log('测验: '+roots.length+' 题','i');
            // Detect mode from iframe doc URL
            var m = 'chapterTest';
            try {
                var p = (doc.location || {}).pathname || '';
                if (/\/mooc2\/work\/dowork/.test(p)) m = 'homework';
                else if (/\/work\/doHomeWorkNew/.test(p)) m = 'chapterTest';
                else if (/\/exam\/test/.test(p)) m = 'oldExam';
                else if (/\/mooc2\/exam\/preview/.test(p)) m = 'newExam';
            } catch(e) {}
            var cfg = getModeConfig(m);
            (async function ql(i) {
                if (i >= roots.length) {
                    log('测验答题完成，提交中…','s');
                    // Get the quiz iframe window
                    var qWin = doc.defaultView || doc.parentWindow;
                    // Step 1: Try platform submit functions directly (OCS pattern — most reliable)
                    try {
                        if (qWin && qWin.btnBlueSubmit) {
                            qWin.btnBlueSubmit();
                            log('已调用 btnBlueSubmit','s');
                        } else if (_w.btnBlueSubmit) {
                            _w.btnBlueSubmit();
                            log('已调用 top.btnBlueSubmit','s');
                        }
                    } catch(e) {}
                    // Step 2: Click DOM submit button as fallback
                    var clicked = false;
                    var allDocs = [doc];
                    try { if (_w.top && _w.top.document) allDocs.push(_w.top.document); } catch(e) {}
                    try { if (_w.parent && _w.parent.document && _w.parent !== _w) allDocs.push(_w.parent.document); } catch(e) {}
                    for (var di = 0; di < allDocs.length && !clicked; di++) {
                        var d = allDocs[di];
                        var submitSelectors = ['.Btn_blue_1', '.sub_btn', '.saveYl', '.btn_blue', '.submit-btn', 'button'];
                        for (var si2 = 0; si2 < submitSelectors.length && !clicked; si2++) {
                            try {
                                var btns = d.querySelectorAll(submitSelectors[si2]);
                                for (var bi = 0; bi < btns.length && !clicked; bi++) {
                                    var txt = (btns[bi].textContent || btns[bi].value || '').trim();
                                    if (/提交|交卷|保存/.test(txt) && !/暂存|取消|关闭/.test(txt)) {
                                        clickIt(btns[bi]);
                                        clicked = true;
                                        log('已点击提交: '+txt.substring(0,10),'s');
                                    }
                                }
                            } catch(e) {}
                        }
                    }
                    // Step 3: Handle confirmation dialog — poll and auto-confirm
                    await sleep(2000);
                    var confirmAttempts = 0;
                    var confirmDone = false;
                    await new Promise(function(resolveConfirm) {
                        var ci2 = setInterval(function() {
                            confirmAttempts++;
                            if (confirmDone || confirmAttempts > 20) { clearInterval(ci2); resolveConfirm(); return; }
                            // Check all accessible windows for confirm dialog
                            var windows = [qWin, _w];
                            try { if (_w.top && _w.top !== _w) windows.push(_w.top); } catch(e) {}
                            try { if (_w.parent && _w.parent !== _w) windows.push(_w.parent); } catch(e) {}
                            for (var wi = 0; wi < windows.length && !confirmDone; wi++) {
                                var w = windows[wi];
                                if (!w) continue;
                                try {
                                    // Try calling submitCheckTimes directly (OCS pattern)
                                    if (w.submitCheckTimes) {
                                        w.submitCheckTimes();
                                        confirmDone = true;
                                        log('已调用 submitCheckTimes ✓','s');
                                    }
                                } catch(e) {}
                                try {
                                    var wd = w.document;
                                    if (!wd) continue;
                                    // Try common confirm button selectors
                                    var confirmSelectors = [
                                        '.layui-layer-btn0', '.layui-layer-btn .layui-layer-btn0',
                                        '#okBtn', '.confirm-btn', '.dialog-btn-ok',
                                        '.layui-layer-dialog .layui-layer-btn0',
                                        '.workpop .Btn_blue_1', '#workpop .btn_blue',
                                        '.ui-dialog-btn-ok', '[onclick*=submitCheckTimes]'
                                    ];
                                    for (var ci2 = 0; ci2 < confirmSelectors.length && !confirmDone; ci2++) {
                                        var cbs = wd.querySelectorAll(confirmSelectors[ci2]);
                                        for (var cbi = 0; cbi < cbs.length && !confirmDone; cbi++) {
                                            var cb = cbs[cbi];
                                            var cbt = (cb.textContent || cb.value || '').trim();
                                            if (cbt && /确定|是|提交|确认/.test(cbt) && !/取消|否|关闭/.test(cbt)) {
                                                clickIt(cb);
                                                confirmDone = true;
                                                log('已确认: '+cbt.substring(0,10),'s');
                                            } else if (!cbt || cbt.length <= 2) {
                                                // Button with minimal text (like "确定") — just click it
                                                clickIt(cb);
                                                confirmDone = true;
                                                log('已确认弹窗按钮','s');
                                            }
                                        }
                                    }
                                    // Hide workpop if visible
                                    try {
                                        var wp = wd.querySelector('#workpop');
                                        if (wp && wp.style.display !== 'none') {
                                            // Click confirm inside workpop
                                            var wpBtn = wp.querySelector('.Btn_blue_1, .btn_blue, [onclick*=submitCheckTimes]');
                                            if (wpBtn) { clickIt(wpBtn); confirmDone = true; log('已确认 workpop','s'); }
                                        }
                                    } catch(e) {}
                                } catch(e) {}
                            }
                        }, 800);
                    });
                    // Step 4: Try to hide any remaining popups
                    try { if (qWin && qWin.$) qWin.$('#workpop').hide(); } catch(e) {}
                    try { if (_w.$) _w.$('#workpop').hide(); } catch(e) {}
                    try { _w.top && _w.top.$ && _w.top.$('#workpop').hide(); } catch(e) {}
                    log('测验完成 ✓','s');
                    return;
                }
                var result = await processOneQuestion(cfg, roots[i], i);
                if (result && !result.answered) log('测验题 ✓','s');
                setTimeout(function(){ ql(i+1); }, 800);
            })(0);
        }, 2000);
    }
    function schedSkip(d){if(!studying||sSkipPend)return;if(sSkipTimer)clearTimeout(sSkipTimer);sSkipTimer=setTimeout(function(){sSkipTimer=null;if(studying)doSkip();},d);}
    function doSkip(){if(!studying||sSkipPend||now()-sLastNav<8000)return;sSkipPend=true;sLastNav=now();sProcessing=false;sTaskQ=[];try{var b=window.top.document.querySelector('#prevNextFocusNext');if(b)clickIt(b);}catch(e){}setTimeout(function(){sSkipPend=false;},6000);}
    function setSpeed(v){speed=v;sv('ds_spd9',v);updateSpeedUI();try{function ap(doc){doc.querySelectorAll('video').forEach(function(el){try{el.playbackRate=v;}catch(e){}});doc.querySelectorAll('iframe').forEach(function(f){try{ap(f.contentDocument||f.contentWindow.document);}catch(e){}});}ap(document);}catch(e){}log('倍速 → '+v+'x','s');}

    // ═══════════ UI PANEL (Modern Indigo-Blue Design) ═══════════
    function buildPanel() {
        if (document.getElementById('ds-p')) return;
        try { if (window.top !== window.self && window.top.document.getElementById('ds-p')) return; } catch(e) {}
        if (!document.body) { setTimeout(buildPanel, 200); return; }

        var s1=speed===1.0?' on':'', s15=speed===1.5?' on':'', s2=speed===2.0?' on':'';
        var p = document.createElement('div'); p.id = 'ds-p';
        p.innerHTML = [
            '<div id="ds-h"><span class="ds-brand"><span class="ds-dot"></span>✨ DS 学习通 <span id="ds-ml" class="ds-mode m-auto">auto</span></span><span class="ds-hb"><button id="ds-mini" title="折叠">−</button><button id="ds-hide" title="关闭">✕</button></span></div>',
            '<div id="ds-tabs"><button data-tab="answer" class="on">📝 答题</button><button data-tab="study">📚 刷课</button><button data-tab="settings">⚙ 设置</button></div>',
            '<div id="ds-body">',
              // ── Answer tab ──
              '<div class="ds-tab-pane on" data-pane="answer">',
                '<div class="ds-lab">答题控制</div>',
                '<div class="ds-row"><button id="ds-a-go" class="ds-go">▶ 开始答题</button><button id="ds-a-stop" class="ds-stop" style="display:none">⏹ 停止</button></div>',
                '<div class="ds-tgl"><label><input type="checkbox" id="ds-a-redo"'+(C.redo?' checked':'')+'>重做已答题</label><label><input type="checkbox" id="ds-a-alter"'+(C.alterTitle?' checked':'')+'>页内显答案</label></div>',
                '<select id="ds-a-sub" style="width:100%;"><option value="0"'+(C.autoSubmit===0?' selected':'')+'>不自动提交</option><option value="1"'+(C.autoSubmit===1?' selected':'')+'>答完自动提交</option></select>',
                '<div class="ds-sep"></div>',
                // ── Results ──
                '<div id="ds-results">',
                  '<div id="ds-res-header"><span class="ds-lab">答题结果</span><span class="ds-res-count" id="ds-res-count">0/0</span></div>',
                  '<div style="margin-bottom:6px;"><button id="ds-res-clear" style="border:1.5px solid #e5e7eb;border-radius:8px;background:#f9fafb;cursor:pointer;font-size:10.5px;color:#6b7280;padding:4px 12px;font-weight:600;">清空列表</button></div>',
                  '<div id="ds-res-list"><div class="r-empty">等待答题…</div></div>',
                '</div>',
              '</div>',
              // ── Study tab ──
              '<div class="ds-tab-pane" data-pane="study">',
                '<div class="ds-lab">刷课控制</div>',
                '<div class="ds-row"><button id="ds-s-go" class="ds-study">🎬 开始刷课</button><button id="ds-s-stop" class="ds-stop" style="display:none">⏹ 停止</button></div>',
                '<div id="ds-spd-bar" class="ds-spd"><button id="ds-sp1" class'+s1+'>1×</button><button id="ds-sp15" class'+s15+'>1.5×</button><button id="ds-sp2" class'+s2+'>2×</button></div>',
                '<div class="ds-tgl"><label><input type="checkbox" id="ds-s-vid"'+(C.doVideo?' checked':'')+'>视频</label><label><input type="checkbox" id="ds-s-aud"'+(C.doAudio?' checked':'')+'>音频</label><label><input type="checkbox" id="ds-s-quiz"'+(C.doQuiz?' checked':'')+'>测验</label><label><input type="checkbox" id="ds-s-ppt"'+(C.doPPT?' checked':'')+'>PPT</label></div>',
              '</div>',
              // ── Settings tab ──
              '<div class="ds-tab-pane" data-pane="settings">',
                '<div class="ds-lab">API 配置</div>',
                '<input type="password" id="ds-key" placeholder="DeepSeek API Key (sk-…)" value="'+escHtml(C.apiKey)+'">',
                '<select id="ds-model"><option value="deepseek-chat"'+(C.model==='deepseek-chat'?' selected':'')+'>DeepSeek-V3</option><option value="deepseek-reasoner"'+(C.model==='deepseek-reasoner'?' selected':'')+'>DeepSeek-R1 (深度思考)</option></select>',
                '<button id="ds-save" class="ds-save">💾 保存配置</button>',
              '</div>',
              '<div class="ds-sep"></div>',
              '<div class="ds-lab">控制台</div>',
              '<div id="ds-log"></div>',
            '</div>',
            '<div id="ds-ft">DS 学习通助手 v7.6 · F9 显隐 · OCS+万能引擎</div>',
        ].join('\n');
        document.body.appendChild(p);
        var r = p.getBoundingClientRect();
        p.style.left = Math.max(12, Math.round((window.innerWidth-r.width)/2))+'px';
        p.style.top = Math.max(12, Math.round((window.innerHeight-r.height)/2)-Math.round(window.innerHeight*0.1))+'px';

        // Drag
        var hdr=document.getElementById('ds-h'),drag=false,ox=0,oy=0;
        hdr.addEventListener('mousedown',function(e){if(e.target.tagName==='BUTTON')return;drag=true;var r2=p.getBoundingClientRect();ox=e.clientX-r2.left;oy=e.clientY-r2.top;document.body.style.userSelect='none';});
        document.addEventListener('mousemove',function(e){if(!drag)return;p.style.left=(e.clientX-ox)+'px';p.style.top=(e.clientY-oy)+'px';});
        document.addEventListener('mouseup',function(){drag=false;document.body.style.userSelect='';});

        // Tabs
        document.querySelectorAll('#ds-tabs button').forEach(function(btn){btn.addEventListener('click',function(){switchTab(btn.getAttribute('data-tab'));});});

        // Header buttons
        document.getElementById('ds-mini').addEventListener('click',function(){p.classList.toggle('ds-collapsed');});
        document.getElementById('ds-hide').addEventListener('click',function(){p.classList.add('ds-hide');});

        // Save config
        document.getElementById('ds-save').addEventListener('click',function(){
            C.apiKey=document.getElementById('ds-key').value.trim();C.model=document.getElementById('ds-model').value;
            C.redo=document.getElementById('ds-a-redo').checked;
            C.alterTitle=document.getElementById('ds-a-alter').checked;C.autoSubmit=parseInt(document.getElementById('ds-a-sub').value);
            C.doVideo=document.getElementById('ds-s-vid').checked;C.doAudio=document.getElementById('ds-s-aud').checked;
            C.doQuiz=document.getElementById('ds-s-quiz').checked;C.doPPT=document.getElementById('ds-s-ppt').checked;
            sc();log('配置已保存 ✓','s');toast('配置已保存');
        });

        // Answer controls
        document.getElementById('ds-a-go').addEventListener('click',startAnswer);
        document.getElementById('ds-a-stop').addEventListener('click',stopAnswer);
        document.getElementById('ds-res-clear').addEventListener('click',function(){clearResults();});

        // Study controls
        document.getElementById('ds-s-go').addEventListener('click',startStudy);
        document.getElementById('ds-s-stop').addEventListener('click',stopStudy);
        document.getElementById('ds-sp1').addEventListener('click',function(){setSpeed(1.0);});
        document.getElementById('ds-sp15').addEventListener('click',function(){setSpeed(1.5);});
        document.getElementById('ds-sp2').addEventListener('click',function(){setSpeed(2.0);});
    }

    function switchTab(t) {
        tab=t;
        document.querySelectorAll('#ds-tabs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-tab')===t);});
        document.querySelectorAll('.ds-tab-pane').forEach(function(p){p.classList.toggle('on',p.getAttribute('data-pane')===t);});
    }
    function updateModeLabel(m) {
        var el = document.getElementById('ds-ml'); if (!el) return;
        el.textContent = m;
        el.className = 'ds-mode ' + ((m==='homework'||m==='chapterTest')?'m-work':(m==='oldExam'||m==='newExam')?'m-exam':'m-auto');
    }
    function updateAnswerUI() {
        var go=document.getElementById('ds-a-go'),stop=document.getElementById('ds-a-stop'),dot=document.querySelector('#ds-h .ds-dot');
        if(go)go.style.display=answering?'none':'';
        if(stop)stop.style.display=answering?'':'none';
        if(dot){if(answering||studying)dot.classList.add('on');else dot.classList.remove('on');}
    }
    function updateStudyUI() {
        var go=document.getElementById('ds-s-go'),stop=document.getElementById('ds-s-stop'),spd=document.getElementById('ds-spd-bar');
        if(go)go.style.display=studying?'none':''; if(stop)stop.style.display=studying?'':'none';
        if(spd)spd.style.display=studying?'flex':'none'; updateAnswerUI();
    }
    function updateSpeedUI() {
        document.querySelectorAll('#ds-spd-bar button').forEach(function(b){b.classList.remove('on');});
        var act=document.getElementById('ds-sp'+speed.toString().replace('.','')); if(act)act.classList.add('on');
    }

    // ═══════════ BACKEND ANSWER CAPTURE (JSON hook) ═══════════
    var backendCache = {};
    try { backendCache = JSON.parse(gv('ds_bcache9', '{}')); } catch(e) {}

    function saveBackendCache() { try { sv('ds_bcache9', JSON.stringify(backendCache)); } catch(e) {} }

    // Recursively search an object for question-answer pairs
    function extractAnswers(obj, depth) {
        if (!obj || typeof obj !== 'object' || depth > 8) return;
        if (depth === undefined) depth = 0;
        // Pattern 1: questionDtos array (超星 exam API)
        if (Array.isArray(obj)) {
            for (var i = 0; i < obj.length; i++) extractAnswers(obj[i], depth + 1);
        }
        // Pattern 2: object with answer/rightAnswer field
        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            var val = obj[key];
            // Look for answer fields
            if ((key === 'answer' || key === 'rightAnswer' || key === 'correctAnswer' || key === 'answers') && typeof val === 'string' && val.trim()) {
                var qKey = '';
                if (obj.question) qKey = cleanQ(String(obj.question));
                else if (obj.name) qKey = cleanQ(String(obj.name));
                else if (obj.title) qKey = cleanQ(String(obj.title));
                if (qKey && qKey.length > 2) {
                    backendCache[hashQ(qKey, [])] = val.trim();
                }
            }
            // Pattern 3: answerResult or similar
            if (key === 'answerResult' || key === 'result') {
                extractAnswers(val, depth + 1);
            }
            // Pattern 4: datas array from 超星
            if (key === 'datas' && Array.isArray(val)) {
                for (var j = 0; j < val.length; j++) {
                    var d = val[j];
                    if (d.answer) {
                        var dk = cleanQ(String(d.name || d.question || d.title || ''));
                        if (dk && dk.length > 2) backendCache[hashQ(dk, [])] = String(d.answer).trim();
                    }
                }
            }
            // Recurse into nested objects
            if (val && typeof val === 'object') extractAnswers(val, depth + 1);
        }
    }

    // Install JSON.parse hook to capture API response answers
    (function installHook() {
        try {
            var _parse = JSON.parse;
            JSON.parse = function() {
                var o = _parse.apply(this, arguments);
                try { extractAnswers(o); saveBackendCache(); } catch(e) {}
                return o;
            };
        } catch(e) {}
    })();

    // Check backend cache before AI call
    function checkBackendCache(qText, opts) {
        var ck = hashQ(qText, opts);
        if (backendCache[ck]) return backendCache[ck];
        return null;
    }
    document.addEventListener('keydown',function(e){
        if(e.keyCode===120){ var p=document.getElementById('ds-p'); if(p)p.classList.toggle('ds-hide');else buildPanel(); }
    });

    function init() {
        buildPanel();
        mode = detectMode(); updateModeLabel(mode);
        var path = _l.pathname;
        if (/\/mooc2\/work\/dowork|\/mooc-ans\/|exam\/test|exam\/preview|\/work\/phone\/doHomeWork|\/work\/doHomeWorkNew/.test(path)) {
            log('📍 '+mode+' 页面 (OCS+万能引擎就绪)','i');
            if (!C.apiKey) log('⚠ 请先配置API Key','w');
        } else if (/\/knowledge\/cards|\/mycourse\/studentstudy/.test(path)) {
            log('📍 课程页面','i'); switchTab('study');
            if (!C.apiKey) log('⚠ 请先配置API Key','w');
        }
        log('DS助手 v7.6 就绪','s');
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }

})();
