import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { localizationSource, TOOLKIT_VERSION } from '../src/patcher.mjs';
import { sha256 } from '../src/asar.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const candidates = [process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
const browser = candidates.find(candidate => fs.existsSync(candidate));
if (!browser) throw new Error('没有找到 Edge；可通过 EDGE_PATH 指定已有 Edge 可执行文件。不会下载安装浏览器。');

const source = localizationSource().replaceAll('</script', '<\\/script');
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'src/dictionary.json'), 'utf8'));
const dollarDictionary = { ...dictionary, 'Dollar probe': "金额 $$ $& $' $` $200" };
const dollarSource = localizationSource().replace('const dictionary = ' + JSON.stringify(dictionary) + ';', () => 'const dictionary = ' + JSON.stringify(dollarDictionary) + ';');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Gemini Windows ZH — 模拟页面测试</title>
<style>body{margin:0;font:18px 'Microsoft YaHei',sans-serif;color:#243044;background:#f4f7fb}header{padding:28px;background:#17375e;color:white}small{font-size:14px;opacity:.8}.layout{display:grid;grid-template-columns:270px 1fr;gap:32px;padding:32px}aside,main{background:white;border-radius:18px;padding:28px}button,a{display:block;margin:14px 0;padding:10px 14px;border:1px solid #dbe2ec;border-radius:10px;color:#243044;text-decoration:none;background:#fafcff}h1{font-size:28px}user-query,model-response,[role=article]{display:block;background:#f4f7fb;padding:15px;margin:12px 0;border-radius:12px}input{width:90%;padding:12px;font:inherit}#result{font-size:13px;white-space:pre-wrap}#result:empty{display:none}</style>
<header>Gemini Windows ZH <small>模拟界面 · 非真实账号 · 不含 Google 程序文件</small></header>
<div class="layout"><aside><a id="new-chat" href="/app">New chat</a><button id="search" aria-label="Search chats">Search chats</button><span>Notebooks</span><a id="history" href="/app/0123456789abcdef">New chat</a><div role="menu"><h3>Account</h3><button role="menuitem" id="settings">Task settings</button><span>Data &amp; privacy</span></div></aside>
<main><h1 class="zero-state-block-container" id="welcome">Where should we start?</h1><div class="modular-zero-state-container"><div class="gds-display-m" id="angular-welcome">Where should we start?</div></div><button id="model-picker" aria-label="Open mode picker, currently Flash">Flash</button><button id="dictate" aria-label="Dictate (^⇧D)">Dictate</button><div id="plain-text">New chat</div><user-query><span id="user-text">New chat</span><button id="user-button">Save</button></user-query><model-response><h2 id="model-heading">Theme</h2><pre id="code">Save</pre></model-response><div role="article"><button id="article-button">Close</button></div><input id="prompt" placeholder="Ask Gemini" value="New chat"><div id="editable" contenteditable="true">Save</div><div id="gemini-editor" class="ql-editor" contenteditable="true" aria-label="Enter a prompt for Gemini">New chat</div><pre id="result"></pre></main></div>
<script>
addEventListener('error',event=>{document.documentElement.dataset.testError=String(event.message);});
addEventListener('unhandledrejection',event=>{document.documentElement.dataset.testError=String(event.reason?.stack||event.reason);});
window.fixtureLocation={protocol:'https:',hostname:'gemini.google.com',pathname:'/app',href:'https://gemini.google.com/app'};
(function(){ const location=window.fixtureLocation; ${source} })();
(async()=>{
 const results=[]; const assert=(name,condition)=>results.push({name,pass:Boolean(condition)});
 const value=id=>document.getElementById(id).textContent; const pause=()=>new Promise(r=>setTimeout(r,220));
 assert('navigation label translated',value('new-chat')==='新对话');
 assert('button and accessibility label translated',value('search')==='搜索对话'&&document.getElementById('search').getAttribute('aria-label')==='搜索对话');
 assert('welcome translated',value('welcome')==='我们从哪里开始？');
 assert('observed Angular welcome has visible Chinese layer',document.querySelector('#angular-welcome>[data-gemini-zh-welcome-overlay]')?.textContent==='我们从哪里开始？');
 const log=document.createElement('div');log.setAttribute('role','log');log.innerHTML='<div class="zero-state-block-container"><div class="gds-display-m">Where should we start?</div></div><model-response><span>Where should we start?</span></model-response>';document.querySelector('main').append(log);await pause();
 assert('zero-state welcome inside conversation log has a scoped exception',log.querySelector('.gds-display-m>[data-gemini-zh-welcome-overlay]')?.textContent==='我们从哪里开始？'&&log.querySelector('model-response').textContent==='Where should we start?');
 const split=document.createElement('div');split.className='gds-display-m';split.innerHTML='<span>Where </span><span>should </span><span>we </span><span>start?</span>';
 document.querySelector('.modular-zero-state-container').append(split);await pause();
 assert('animated split heading keeps original tokens and visible translation',split.querySelector('[data-gemini-zh-welcome-overlay]')?.textContent==='我们从哪里开始？'&&[...split.querySelectorAll('span:not([data-gemini-zh-welcome-overlay])')].map(x=>x.textContent).join('')==='Where should we start?');
 assert('model-picker accessibility label translated',document.getElementById('model-picker').getAttribute('aria-label')==='选择模型，当前为 Flash');
 assert('dictation label retains keyboard shortcut',document.getElementById('dictate').getAttribute('aria-label')==='语音输入 (^⇧D)');
 assert('prompt editor label changes without changing draft',document.getElementById('gemini-editor').getAttribute('aria-label')==='向 Gemini 输入问题'&&value('gemini-editor')==='New chat');
 assert('history title preserved',value('history')==='New chat');
 assert('user message preserved',value('user-text')==='New chat'&&value('user-button')==='Save');
 assert('model output and code preserved',value('model-heading')==='Theme'&&value('code')==='Save');
 assert('article content preserved',value('article-button')==='Close');
 assert('plain non-UI text preserved',value('plain-text')==='New chat');
 assert('input value and editable content preserved',document.getElementById('prompt').value==='New chat'&&value('editable')==='Save');
 assert('input hint translated',document.getElementById('prompt').placeholder==='向 Gemini 提问');
 const dynamic=document.createElement('button');dynamic.id='dynamic';dynamic.textContent='Save';document.querySelector('aside').append(dynamic);await pause();
 assert('SPA-added navigation control translated',dynamic.textContent==='保存');
 document.getElementById('settings').textContent='Close';await pause();
 assert('rerendered menu item translated',value('settings')==='关闭');
 fixtureLocation.pathname='/app/0123456789abcdef';
 const messageButton=document.createElement('button');messageButton.textContent='New chat';document.querySelector('main').append(messageButton);await pause();
 assert('unrecognized conversation area fails closed',messageButton.textContent==='New chat');
 const tooltip=document.createElement('div');tooltip.setAttribute('role','tooltip');tooltip.textContent='Close sidebar';document.body.append(tooltip);await pause();
 assert('hover tooltip created outside navigation translates on a conversation route',tooltip.textContent==='收起侧边栏');
 tooltip.textContent='Search chats';await pause();assert('reused hover tooltip text is translated',tooltip.textContent==='搜索对话');
 const materialTip=document.createElement('div');materialTip.className='mat-mdc-tooltip-surface';materialTip.textContent='Close sidebar';document.body.append(materialTip);await pause();
 assert('Material tooltip without a role is translated',materialTip.textContent==='收起侧边栏');
 const searchDialog=document.createElement('div');searchDialog.setAttribute('role','dialog');searchDialog.innerHTML='<input aria-label="Search chats" placeholder="Search chats" value="unsent draft"><div id="recent-caption">Recents</div><a href="/app/abcdef0123456789"><span>Recents</span></a>';
 document.body.append(searchDialog);await pause();
 assert('search dialog input label translates away from home without changing draft',searchDialog.querySelector('input').getAttribute('aria-label')==='搜索对话'&&searchDialog.querySelector('input').placeholder==='搜索对话'&&searchDialog.querySelector('input').value==='unsent draft');
 assert('search chrome translates while a same-word result title stays original',searchDialog.querySelector('#recent-caption').textContent==='最近'&&searchDialog.querySelector('a').textContent==='Recents');
 const library=document.createElement('section');library.className='route-island-host';library.innerHTML='<div><h1>Library</h1><h2>Documents</h2><p>Documents you create will appear here</p><h2>Media</h2><button class="document-card">Documents</button></div>';document.body.append(library);await pause();
 assert('semantic library headings and empty-state caption translate',library.textContent.includes('文档')&&library.textContent.includes('你创建的文档会显示在这里')&&library.textContent.includes('媒体'));
 assert('same-word library document name stays original',library.querySelector('button').textContent==='Documents');
 const customize=document.createElement('section');customize.className='main-content customize-page';customize.innerHTML='<div class="header-title">Customize Gemini</div><p>Add apps and skills so Gemini can work smarter for you</p><button class="category-header"><span class="category-heading">Home</span></button><button aria-label="Add Google Workspace">Google Workspace</button><div class="skill-card">Match your writing style</div><span class="file-name">Home</span>';document.body.append(customize);await pause();
 assert('customize page and contextual home category translate',customize.textContent.includes('自定义 Gemini')&&customize.querySelector('.category-heading').textContent==='居家');
 assert('catalog add accessibility label preserves brand',customize.querySelector('[aria-label]').getAttribute('aria-label')==='添加 Google Workspace');
 assert('custom skill and file names stay original',customize.querySelector('.skill-card').textContent==='Match your writing style'&&customize.querySelector('.file-name').textContent==='Home');
 const daily=document.createElement('section');daily.className='your-day-status-unenrolled';daily.innerHTML='<h2>Your day, summarized in one place</h2><button>Generate now</button>';document.body.append(daily);await pause();
 assert('daily brief onboarding text and call to action translate',daily.querySelector('h2').textContent==='一天要事，一目了然'&&daily.querySelector('button').textContent==='立即生成');
 const dailyReport=document.createElement('section');dailyReport.className='your-day-page';dailyReport.textContent='Your day, summarized in one place';document.body.append(dailyReport);await pause();
 assert('daily brief output outside onboarding stays original',dailyReport.textContent==='Your day, summarized in one place');
 const scheduled=document.createElement('section');scheduled.className='main-content';scheduled.innerHTML='<div class="title">Scheduled</div><button aria-label="Filter scheduled tasks by status">Scheduled</button><div class="task-title">Create a scheduled task</div>';document.body.append(scheduled);await pause();
 assert('scheduled filter label translates without changing user task title',scheduled.querySelector('button').getAttribute('aria-label')==='按状态筛选定时任务'&&scheduled.querySelector('.task-title').textContent==='Create a scheduled task');
 const usage=document.createElement('section');usage.className='route-island-host';usage.innerHTML='<button aria-label="Information about usage limits"></button><p>Current usage</p><span>Updated just now</span>';document.body.append(usage);await pause();
 assert('observed usage island translates known controls and captions',usage.querySelector('button').getAttribute('aria-label')==='使用限额说明'&&usage.querySelector('p').textContent==='当前用量'&&usage.querySelector('span').textContent==='刚刚更新');
 const links=document.createElement('section');links.className='route-island-host';links.innerHTML='<button>Delete all links</button><div role="listitem"><span>Current usage</span><button>Delete</button></div>';document.body.append(links);await pause();
 assert('public links bulk action translates while link records stay original',links.querySelector('button').textContent==='删除所有链接'&&links.querySelector('[role="listitem"] span').textContent==='Current usage'&&links.querySelector('[role="listitem"] button').textContent==='Delete');
 const arbitraryIsland=document.createElement('section');arbitraryIsland.className='route-island-host';arbitraryIsland.innerHTML='<p>Current usage</p>';document.body.append(arbitraryIsland);await pause();
 assert('an unrecognized React island is not a localization scope',arbitraryIsland.textContent==='Current usage');
 fixtureLocation.pathname='/mavatar';
 const avatar=document.createElement('section');avatar.className='main-content';avatar.innerHTML='<h1 class="likeness-title">Your avatar</h1><div class="likeness-card"><span class="profile-name">Theme</span><p>Use your avatar anytime by typing <span class="username">@sample_user</span> into your prompt.</p><button>Create an avatar</button><button>Who can use your avatar</button><button>Avatars shared with you</button><button>Delete avatar</button><div class="skill-card">Task settings</div><div class="memory-content">Create an avatar</div></div>';
 document.body.append(avatar);await pause();
 assert('avatar secondary page heading and controls translate',avatar.querySelector('h1').textContent==='你的虚拟形象'&&avatar.querySelector('button').textContent==='创建虚拟形象');
 assert('avatar secondary page static rows translate',avatar.textContent.includes('谁可以使用你的虚拟形象')&&avatar.textContent.includes('与你共享的虚拟形象')&&avatar.textContent.includes('删除虚拟形象'));
 assert('profile name and user skill/memory content remain original',avatar.querySelector('.profile-name').textContent==='Theme'&&avatar.querySelector('.skill-card').textContent==='Task settings'&&avatar.querySelector('.memory-content').textContent==='Create an avatar');
 assert('avatar handle remains unchanged',avatar.querySelector('.username').textContent==='@sample_user');
 const tasks=document.createElement('section');tasks.className='main-content';tasks.innerHTML='<h1 class="title">Task settings</h1><p>Use task mode to hand off work</p><p>Let Gemini use task mode on your behalf. Turning this off deletes your browsing data and remote code execution files, and stops your scheduled tasks.</p><button>Turn off</button><input type="checkbox" checked value="Theme"><select><option selected>System</option></select>';
 document.body.append(tasks);await pause();
 assert('task settings explanatory text translates',tasks.textContent.includes('关闭此功能会删除浏览数据和远程代码执行文件，并停止定时任务。'));
 assert('settings values and toggle states remain unchanged',tasks.querySelector('input').checked&&tasks.querySelector('input').value==='Theme'&&tasks.querySelector('select').value==='System');
 fixtureLocation.pathname='/app/0123456789abcdef';window.__geminiWindowsZh.refresh();
 assert('settings-page support still leaves conversation controls alone',messageButton.textContent==='New chat');
 document.getElementById('search').setAttribute('aria-label','Custom label');await pause();
 window.__geminiWindowsZh.disable();
 assert('disable restores original navigation text',value('new-chat')==='New chat');
 assert('disable preserves app-updated attribute',document.getElementById('search').getAttribute('aria-label')==='Custom label');
 assert('disable restores original input hint',document.getElementById('prompt').placeholder==='Ask Gemini');
 assert('disable restores every animated heading token',split.textContent==='Where should we start?'&&split.querySelectorAll('span').length===4);
 assert('disable restores tooltip and secondary-page text',tooltip.textContent==='Search chats'&&avatar.querySelector('button').textContent==='Create an avatar');
 const replacement=document.createElement('button');replacement.textContent='Search chats';document.querySelector('aside').append(replacement);
 window.__geminiWindowsZh.enable();await pause();
 assert('reenable applies navigation translations',value('new-chat')==='新对话');
 assert('reenable observes controls added while disabled',replacement.textContent==='搜索对话');
 window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
 window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
 const restoredTip=document.createElement('div');restoredTip.setAttribute('role','tooltip');restoredTip.textContent='Close sidebar';document.body.append(restoredTip);await pause();
 assert('back-forward cache restoration resumes dynamic translation',restoredTip.textContent==='收起侧边栏');
 fixtureLocation.pathname='/app';window.__geminiWindowsZh.refresh();
 // Isolated documents avoid the existing conversation fixture masking a
 // whole-document traversal bug through its message-content guard.
 function isolated(markup,route='/app',engine=${JSON.stringify(source)}) {
  const frame=document.createElement('iframe');document.body.append(frame);
  const w=frame.contentWindow,d=w.document;d.open();d.write('<!doctype html><html><head></head><body>'+markup+'</body></html>');d.close();
  const location={protocol:'https:',hostname:'gemini.google.com',pathname:route,href:'https://gemini.google.com'+route};
  w.eval('(function(){const location='+JSON.stringify(location)+';'+engine+'})();');
  return {w,d,close(){w.__geminiWindowsZh.disable();w.dispatchEvent(new w.PageTransitionEvent('pagehide'));frame.remove();}};
 }
 let page=isolated('<section><button id="record">Media</button><a id="file">Travel</a></section>');
 assert('home route alone does not translate unknown user controls',page.d.querySelector('#record').textContent==='Media'&&page.d.querySelector('#file').textContent==='Travel');page.close();
 page=isolated('<button aria-label="Open mode picker, currently Flash">Flash</button><button aria-label="Dictate (^⇧D)"></button>');
 assert('recognized composer labels still translate outside navigation',page.d.querySelector('button').getAttribute('aria-label')==='选择模型，当前为 Flash'&&page.d.querySelectorAll('button')[1].getAttribute('aria-label')==='语音输入 (^⇧D)');page.close();
 page=isolated('<div class="search-island-host"><button aria-label="Search chats">Search chats</button></div><div class="close-sidenav-button"><button aria-label="Close sidebar"></button></div><a class="side-nav-sparkle-button">New chat</a><div class="gem-segmented-button-row"><button>Chat</button><button>Task</button></div>');
 assert('observed sidebar components keep their fixed navigation labels',page.d.querySelector('.search-island-host button').textContent==='搜索对话'&&page.d.querySelector('.close-sidenav-button button').getAttribute('aria-label')==='收起侧边栏'&&page.d.querySelector('a').textContent==='新对话');
 assert('observed chat-task switch remains translated',page.d.querySelector('.gem-segmented-button-row').textContent==='聊天任务');page.close();
 page=isolated('<h1>Library</h1><section><div id="record">Media</div></section>','/unclassified');
 assert('body-level landing heading never expands scope to html',page.d.querySelector('#record').textContent==='Media');page.close();
 page=isolated('<main><h1>Library</h1><section><span id="record">Documents</span></section><figure><h2>Media</h2></figure></main>','/unclassified');
 assert('landing translation preserves same-word non-heading data in main',page.d.querySelector('h1').textContent==='资料库'&&page.d.querySelector('#record').textContent==='Documents'&&page.d.querySelector('figure h2').textContent==='Media');page.close();
 page=isolated('<main><h1>Your public links</h1><button>Delete all links</button><div role="listitem"><span id="record">Theme</span></div><table><tbody><tr><td>Media</td></tr></tbody></table></main>','/public-links');
 assert('settings records outside React islands remain original',page.d.querySelector('#record').textContent==='Theme'&&page.d.querySelector('td').textContent==='Media');
 assert('settings bulk action remains eligible beside protected records',page.d.querySelector('button').textContent==='删除所有链接');page.close();
 page=isolated('<section class="main-content"><p>Theme</p><button>Save</button></section>','/settings/unrecognized');
 assert('settings route alone does not approve unknown page content',page.d.querySelector('p').textContent==='Theme'&&page.d.querySelector('button').textContent==='Save');page.close();
 page=isolated('<main><div class="your-day-status-unenrolled"><div role="listitem">Get a personalized overview</div></div><ul role="menu"><li role="menuitem">Theme</li></ul></main>','/daily-brief');
 assert('first-use and menu lists still translate while data lists are protected',page.d.querySelector('[role=listitem]').textContent==='获取个性化概览'&&page.d.querySelector('[role=menuitem]').textContent==='主题');page.close();
 for(const tag of ['h1','div role="heading"']) {
  const closeTag=tag.split(' ')[0];
  page=isolated('<div class="modular-zero-state-container"><'+tag+' class="gds-display-m"><span>Where </span><span>should </span><span>we </span><span>start?</span></'+closeTag+'></div>');
  for(let i=0;i<5;i++)page.w.__geminiWindowsZh.refresh();
  const heading=page.d.querySelector('.gds-display-m');
  assert('welcome heading overlay stays isolated: '+tag,heading.querySelectorAll('[data-gemini-zh-welcome-overlay]').length===1&&[...heading.children].filter(e=>!e.hasAttribute('data-gemini-zh-welcome-overlay')).map(e=>e.textContent).join('')==='Where should we start?');page.close();
 }
 page=isolated('<nav><button id="split"><span>New </span><span>chat</span></button><button id="icon"><span class="material-icons">Save</span><span>Save</span></button></nav>');
 const splitControl=page.d.querySelector('#split'), icon=page.d.querySelector('.material-icons');
 assert('split control branch translates without removing child nodes',splitControl.children.length===2&&splitControl.firstElementChild.textContent==='新对话'&&splitControl.lastElementChild.textContent==='');
 assert('icon glyph text is protected even when it matches a dictionary word',icon.textContent==='Save');
 page.w.__geminiWindowsZh.disable();
 assert('split control branch restores both original tokens',splitControl.firstElementChild.textContent==='New '&&splitControl.lastElementChild.textContent==='chat');page.close();
 page=isolated('<nav><button>Dollar probe</button></nav>','/app',${JSON.stringify(dollarSource)});
 assert('runtime translation preserves literal dollar replacement patterns',page.d.querySelector('button').textContent===${JSON.stringify(dollarDictionary['Dollar probe'])});page.close();
 assert('engine version matches the package version',window.__geminiWindowsZh.version===${JSON.stringify(TOOLKIT_VERSION)});
 const summary={passed:results.filter(x=>x.pass).length,total:results.length,results};
 document.getElementById('result').textContent=JSON.stringify(summary);
 document.documentElement.dataset.browser=navigator.userAgent;document.documentElement.dataset.testComplete='true';
})();</script></html>`;

const fixture = path.join(artifacts, 'browser-fixture.html');
fs.writeFileSync(fixture, html);
const result = spawnSync(browser, [
  '--headless=new', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-gpu',
  '--user-data-dir=' + fs.mkdtempSync(path.join(artifacts, 'edge-test-profile-')), '--window-size=1280,1000',
  '--virtual-time-budget=10000', '--screenshot=' + path.join(artifacts, 'demo.png'), '--dump-dom', pathToFileURL(fixture).href
], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('浏览器测试进程异常退出');
const output = result.stdout || '';
if (!output.includes('data-test-complete="true"')) {
  fs.writeFileSync(path.join(artifacts, 'incomplete-browser-dom.html'), output);
  fs.writeFileSync(path.join(artifacts, 'browser-launch-error.log'), result.stderr || '');
}
if (!output.includes('data-test-complete="true"')) throw new Error('浏览器测试尚未完成，拒绝将部分结果计为通过: ' + (output.match(/data-test-error="([^"]*)"/)?.[1] || '没有返回完成标记'));
const match = output.match(/<pre id="result">([\s\S]*?)<\/pre>/);
if (!match) throw new Error('浏览器未返回测试结果（未将浏览器内部日志纳入公开报告）');
const summary = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
if (summary.total !== 67 || summary.results?.length !== summary.total || new Set(summary.results.map(item => item.name)).size !== summary.total || summary.passed !== summary.results.filter(item => item.pass === true).length) throw new Error('浏览器测试结果结构或预期的 67 项数量无效');
summary.evidence = { toolkitVersion: TOOLKIT_VERSION, recordedAt: new Date().toISOString(), nodeVersion: process.version, browserUserAgent: output.match(/data-browser="([^"]+)"/)?.[1] || null, sourceSha256: sha256(localizationSource()) };
fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (summary.passed !== summary.total) process.exitCode = 1;
