const API = '';
let chartInstances = {};
const loadedTabs = { overview: true };

function switchTab (tab) {
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));

    document.getElementById(tab).classList.add('active');

    document.querySelectorAll('.nav button').
    forEach(b => {b.classList.remove('active');
        if(b.getAttribute('onclick').includes("'"+tab+"'")){
            b.classList.add('active');
        }
    });

    if(!loadedTabs[tab]){
        loadedTabs[tab] = true;

        const loaders = { ip: loadIP , sentiment: loadSentiment, platform: loadPlatform, user: loadUser, hotsearch: loadHotsearch, comments: loadComments };
        if(loaders[tab]){
            loaders[tab]();
        }
    }

    Object.values(chartInstances).forEach(c => c.resize());
    
}

function initChart(id){
    if(chartInstances[id]){
        chartInstances[id].dispose()
    }

    chartInstances[id] =  echarts.init(document.getElementById(id))

    return chartInstances[id]
}

async function fetchJSON(path){
    try {
        const res =  await fetch(API+path)
        
        if(!res.ok){
            throw new Error('请求失败'+res.status);
        }

        return await res.json()

    } catch (e) {
        console.error('数据加载失败：',path,e);
        return null
    }
} 


function formatNum(n) { return Number(n).toLocaleString('zh-CN'); }

function escapeHTML(str){
    var div = document.createElement('div')
    div.appendChild(document.createTextNode(str));

    return div.innerHTML;
}


// ===== 综合概览 =====
async function loadOverview() {
    const [ipData,sData,pData,commentsData] = await Promise.all([
        fetchJSON('/api/ip-performance'),
        fetchJSON('/api/sentiment'),
        fetchJSON('/api/platform-distribution'),
        fetchJSON('/api/comments')
    ]);

    if(!ipData||!sData||!pData||!commentsData) return;

    var totalSearch = ipData.reduce((sum,d)=>sum +Number(d.total_search_volume),0);

    var totalComments =  commentsData.length;
    
    var positiveCount =  commentsData.filter(c=>c.sentiment === 'positive').length;

    var avgSentiment = totalComments > 0 ?(positiveCount/totalComments *100).toFixed(1):0;

    var topIp = ipData.sort((a,b)=>Number(b.total_search_volume)-Number(a.total_search_volume))[0].ip_name;

    document.getElementById('kpi-total-search').textContent = (totalSearch/10000).toFixed(0)+"万";
    document.getElementById('kpi-total-comments').textContent = formatNum(totalComments);
    document.getElementById('kpi-positive-rate').textContent = avgSentiment + '%';
    document.getElementById('kpi-top-ip').textContent = topIp;


    // IP排名柱状图
    var sorted = ipData.sort((a,b)=>Number(b.total_search_volume)-Number(a.total_search_volume));

    var c1 = initChart('chart-ip-bar')

        c1.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: sorted.map(d => d.ip_name), axisLabel: { rotate: 20 } },
        yAxis: { type: 'value', axisLabel: { formatter: v => (v / 10000).toFixed(0) + '万' } },
        series: [{
            type: 'bar', data: sorted.map(d => Number(d.total_search_volume)),
            itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#c44dff' }, { offset: 1, color: '#6c5ce7' }]) },
            barWidth: '50%'
        }]
    });


    // 情感饼图
    var totalPos = 0, totalNeg = 0, totalNeu = 0;
    sData.forEach(s => { totalPos += Number(s.positive_count); totalNeg += Number(s.negative_count); totalNeu += Number(s.neutral_count); });
    var c2 = initChart('chart-sentiment-pie');
    c2.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 10 },
        series: [{
            type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
            data: [
                { value: totalPos, name: '正面', itemStyle: { color: '#52c41a' } },
                { value: totalNeu, name: '中性', itemStyle: { color: '#faad14' } },
                { value: totalNeg, name: '负面', itemStyle: { color: '#ff4d4f' } }
            ],
            label: { formatter: '{b}: {d}%' }
        }]
    });

    // 平台柱状图
    var c3 = initChart('chart-platform-bar');
    c3.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: pData.map(d => d.platform) },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: pData.map(d => Number(d.comment_count)), itemStyle: { color: '#c44dff' }, barWidth: '40%' }]
    });


}

// ===== IP热度分析 =====
async function loadIP() {
    const data = await fetchJSON('/api/ip-performance')
    if(!data) return;

    const sorted = data.sort((a,b)=>Number(b.brand_value_index) - Number(a.brand_value_index));

    var c1 = initChart('chart-ip-scatter');
    c1.setOption({
        tooltip: { trigger: 'item', formatter: p => p.data[2] + '<br>增长率: ' + p.data[0] + '%<br>品牌价值: ' + p.data[1] },
        grid: { left: 60, right: 30, bottom: 40, top: 20 },
        xAxis: { name: '月增长率(%)', type: 'value' },
        yAxis: { name: '品牌价值指数', type: 'value', min: 50, max: 100 },
        series: [{
            type: 'scatter', symbolSize: d => Math.max(d[0] * 0.8, 15),
            data: data.map(d => [Number(d.monthly_growth_rate), Number(d.brand_value_index), d.ip_name]),
            label: { show: true, formatter: p => p.data[2], position: 'top', fontSize: 11 }
        }]
    });


    var c2 = initChart('chart-ip-comments-bar')

        c2.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: sorted.map(d => d.ip_name), axisLabel: { rotate: 20 } },
        yAxis: { type: 'value', axisLabel: { formatter: v => (v / 10000).toFixed(0) + '万' } },
        series: [{ type: 'bar', data: sorted.map(d => Number(d.total_comments)), itemStyle: { color: '#ff6b9d' }, barWidth: '50%' }]
    });

    var c3 = initChart("chart-ip-sentiment-radar")

    const top5 = sorted.slice(0,5)

    const radarIndicator = [
        { name: '搜索量', max: 1 },
        { name: '评论数', max: 1 },
        { name: '情感分', max: 1 },
        { name: '增长率', max: 1 },
        { name: '品牌价值', max: 1 }
    ];

    const maxSearch = Math.max(...data.map(d=>Number(d.total_search_volume)))
    const maxComments = Math.max(...data.map(d=>Number(d.total_comments)))
    const maxGrowth = Math.max(...data.map(d=>Number(d.monthly_growth_rate)))
    
    const radarData = top5.map(d=>({
        value:[
            Number(d.total_search_volume)/maxSearch,
            Number(d.total_comments)/maxComments,
            Number(d.avg_sentiment_score),
            Number(d.monthly_growth_rate)/maxGrowth,
            Number(d.brand_value_index)/100
        ],
        name:d.ip_name
    }));

        c3.setOption({
        tooltip: {},
        legend: { bottom: 0, data: top5.map(d => d.ip_name) },
        radar: { indicator: radarIndicator, shape: 'polygon', radius: '60%' },
        series: [{ type: 'radar', data: radarData }]
    });

    const dims = ['搜索量', '评论数', '情感分', '增长率', '品牌价值'];
    var c4 = initChart('chart-ip-heatmap');

    const heatData = [];

    sorted.forEach((ip,yi)=>{
        const vals = [
            Number(ip.total_search_volume)/52000000,
            Number(ip.total_comments) / 156000,
            Number(ip.avg_sentiment_score),
            Number(ip.monthly_growth_rate) / 65,
            Number(ip.brand_value_index) / 100
        ];
        vals.forEach((v,xi)=>heatData.push([xi,yi,v.toFixed(2)]));
    });

        c4.setOption({
        tooltip: { formatter: p => sorted[p.data[1]].ip_name + ' - ' + dims[p.data[0]] + ': ' + p.data[2] },
        grid: { left: 100, right: 80, bottom: 30, top: 10 },
        xAxis: { type: 'category', data: dims, splitArea: { show: true } },
        yAxis: { type: 'category', data: sorted.map(d => d.ip_name), splitArea: { show: true } },
        visualMap: { min: 0, max: 1, calculable: true, orient: 'vertical', right: 0, top: 'center', inRange: { color: ['#f5f5f5', '#c44dff', '#6c5ce7'] } },
        series: [{ type: 'heatmap', data: heatData, label: { show: true } }]
    });


}

async function loadSentiment() {
    const data = await fetchJSON('/api/sentiment')
    if(!data) return;

    const sorted = data.sort((a,b)=>Number(b.positive_pct)-Number(a.positive_pct));

    var c1 = initChart('chart-sentiment-stacked')
    c1.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, data: ['正面', '中性', '负面'] },
        grid: { left: 100, right: 30, bottom: 40, top: 20 },
        yAxis: { type: 'category', data: sorted.map(d => d.category) },
        xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
        series: [
            { name: '正面', type: 'bar', stack: 'total', data: sorted.map(d => Number(d.positive_pct)), itemStyle: { color: '#52c41a' } },
            { name: '中性', type: 'bar', stack: 'total', data: sorted.map(d => Number(d.neutral_pct)), itemStyle: { color: '#fad144' } },
            { name: '负面', type: 'bar', stack: 'total', data: sorted.map(d => Number(d.negative_pct)), itemStyle: { color: '#ff4d4f' } }
        ]
    });

        // 正/负面点赞对比
    var c2 = initChart('chart-sentiment-likes');
    c2.setOption({
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0, data: ['正面平均点赞', '负面平均点赞'] },
        grid: { left: 100, right: 30, bottom: 40, top: 20 },
        yAxis: { type: 'category', data: sorted.map(d => d.category) },
        xAxis: { type: 'value' },
        series: [
            { name: '正面平均点赞', type: 'bar', data: sorted.map(d => Number(d.avg_likespositive)), itemStyle: { color: '#52c41a' } },
            { name: '负面平均点赞', type: 'bar', data: sorted.map(d => Number(d.avg_likes_negative)), itemStyle: { color: '#ff4d4f' } }
        ]
    });

    // 情感热力图
    var c3 = initChart('chart-sentiment-heatmap');
    const cats = sorted.map(d => d.category);
    const hData = [];
    sorted.forEach((s, yi) => {
        hData.push([0, yi, Number(s.positive_pct).toFixed(1)]);
        hData.push([1, yi, Number(s.neutral_pct).toFixed(1)]);
        hData.push([2, yi, Number(s.negative_pct).toFixed(1)]);
    });
    c3.setOption({
        tooltip: { formatter: p => cats[p.data[1]] + ' - ' + ['正面', '中性', '负面'][p.data[0]] + ': ' + p.data[2] + '%' },
        grid: { left: 100, right: 80, bottom: 30, top: 10 },
        xAxis: { type: 'category', data: ['正面', '中性', '负面'] },
        yAxis: { type: 'category', data: cats },
        visualMap: { min: 0, max: 95, calculable: true, orient: 'vertical', right: 0, top: 'center', inRange: { color: ['#fff5f5', '#ff4d4f', '#c44dff'] } },
        series: [{ type: 'heatmap', data: hData, label: { show: true, formatter: p => p.data[2] + '%' } }]
    });

}

async function loadPlatform() {
    const data = await fetchJSON('/api/platform-distribution');
    if (!data) return;

    // 评论数与互动对比
    var c1 = initChart('chart-platform-compare');
    c1.setOption({
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0, data: ['评论数', '平均点赞', '平均回复'] },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: data.map(d => d.platform) },
        yAxis: { type: 'value' },
        series: [
            { name: '评论数', type: 'bar', data: data.map(d => Number(d.comment_count)), itemStyle: { color: '#c44dff'} },
            { name: '平均点赞', type: 'bar', data: data.map(d => Number(d.avg_likes)), itemStyle: { color: '#6c5ce7' } },
            { name: '平均回复', type: 'bar', data: data.map(d => Number(d.avg_replies)), itemStyle: { color: '#ff6b9d' } }
        ]
    });

    // 活跃用户占比饼图
    var c2 = initChart('chart-platform-pie');
    c2.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 10 },
        series: [{
            type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
            data: data.map(d => ({ value: Number(d.comment_count), name: d.platform })),
            label: { formatter: '{b}\n{d}%' }
        }]
    });

    // 平台活跃时段热力图
    const platforms = ['微博', '小红书', '抖音'];
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
    const activityData = {
        '微博':   [0.25, 0.35, 0.45, 0.55, 0.65, 0.80, 0.90, 1.00, 0.90, 0.75, 0.60, 0.50, 0.55, 0.45, 0.30],
        '小红书': [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70, 0.80, 0.92, 1.00, 0.85, 0.60],
        '抖音':   [0.30, 0.40, 0.55, 0.75, 0.95, 1.00, 0.85, 0.70, 0.60, 0.55, 0.65, 0.80, 0.90, 0.85, 0.65]
    };

    const heatData = []

    platforms.forEach((p,yi)=>{
        activityData[p].forEach((val,xi)=>{
            heatData.push([xi,yi,val.toFixed(2)]);
        });
    });
    var c3 = initChart('chart-platform-heatmap');
    c3.setOption({
        tooltip: { formatter: p => platforms[p.data[1]] + ' ' + hours[p.data[0]] + ' 活跃度: ' + p.data[2] },
        grid: { left: 80, right: 80, bottom: 30, top: 10 },
        xAxis: { type: 'category', data: hours },
        yAxis: { type: 'category', data: platforms },
        visualMap: { min: 0, max: 1, calculable: true, orient: 'vertical', right: 0, top: 'center', inRange: { color: ['#f5f5f5', '#ff6b9d', '#c44dff'] } },
        series: [{ type: 'heatmap', data: heatData, label: { show: false } }]
    });


}

// ===== 用户画像 =====
async function loadUser() {
    const data = await fetchJSON('/api/demographics');
    if (!data) return;

    const ageMap = {};

    data.forEach(d=>{
        if(!ageMap[d.age_group]){
            ageMap[d.age_group] =  { count: 0, spending: 0, repurchase: 0, n: 0 };
        }

        ageMap[d.age_group].count += Number(d.comment_count)
        ageMap[d.age_group].spending += Number(d.avg_spending_yuan)
        ageMap[d.age_group].repurchase += Number(d.repurchase_rate)
        ageMap[d.age_group].n += 1
    });

    const ages = Object.keys(ageMap)

    var c1 = initChart('chart-user-age');
    c1.setOption({
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0, data: ['评论数', '月均消费(元)'] },
        grid: { left: 80, right: 80, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: ages },
        yAxis: [
            { type: 'value', name: '评论数', position: 'left' },
            { type: 'value', name: '月均消费(元)', position: 'right' }
        ],
        series: [
            { name: '评论数', type: 'bar', data: ages.map(a => ageMap[a].count), itemStyle: { color: '#c44dff' }, barWidth: '40%' },
            { name: '月均消费(元)', type: 'line', yAxisIndex: 1, data: ages.map(a => Math.round(ageMap[a].spending / ageMap[a].n)), itemStyle: { color: '#ff6b9d' }, lineStyle: { width: 3 }, symbol: 'circle', symbolSize: 8 }
        ]
    });

    var c2 = initChart('chart-user-repurchase');
    c2.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: ages },
        yAxis: { type: 'value', max: 1, axisLabel: { formatter: v => (v * 100).toFixed(0) + '%' } },
        series: [{
            type: 'bar', data: ages.map(a => (ageMap[a].repurchase / ageMap[a].n).toFixed(2)),
            itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#6c5ce7' }, { offset: 1, color: '#c44dff' }]) },
            barWidth: '50%', label: { show: true, position: 'top', formatter: p => (p.data * 100).toFixed(0) + '%' }
        }]
    });  
    
    const genderData = {}
    data.forEach(d=>{
        const key = d.gender;
        
        if(!genderData[key]){
            genderData[key] = [];
        }

        genderData[key].push({ip:d.top_ip_preference,count:Number(d.comment_count)});

    });

    const femaleIPs = {}
    const maleIPs = {};

    (genderData['女'] || []).forEach(d=>{
        femaleIPs[d.ip] = (femaleIPs[d.ip] || 0) +d.count;
    });

    (genderData['男'] || []).forEach(d=>{
        maleIPs[d.ip] = (maleIPs[d.ip] || 0) +d.count;
    });

    const allIPs = [...new Set([...Object.keys(femaleIPs),...Object.keys(maleIPs)])];
    
    var c3 = initChart('chart-user-gender');
    c3.setOption({
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0, data: ['女性', '男性'] },
        grid: { left: 100, right: 30, bottom: 40, top: 20 },
        yAxis: { type: 'category', data: allIPs },
        xAxis: { type: 'value' },
        series: [
            { name: '女性', type: 'bar', data: allIPs.map(ip => femaleIPs[ip] || 0), itemStyle: { color: '#ff6b9d' } },
            { name: '男性', type: 'bar', data: allIPs.map(ip => maleIPs[ip] || 0), itemStyle: { color: '#6c5ce7' } }
        ]
    });

    const spendGroups = {};
    data.forEach(d => {
        const key = d.age_group + d.gender;
        spendGroups[key] = Number(d.avg_spending_yuan);
    });
    var c4 = initChart('chart-user-spending');
    const spendEntries = Object.entries(spendGroups).sort((a, b) => b[1] - a[1]);
    c4.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 100, right: 30, bottom: 30, top: 10 },
        yAxis: { type: 'category', data: spendEntries.map(e => e[0]) },
        xAxis: { type: 'value', name: '月均消费(元)' },
        series: [{
            type: 'bar', data: spendEntries.map(e => e[1]),
            itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#c44dff' }, { offset: 1, color: '#ff6b9d' }]) },
            barWidth: '60%'
        }]
    });

}


// ===== 热搜趋势 =====
async function loadHotsearch() {
    const data = await fetchJSON('/api/hotsearch');
    if (!data) return;
    const sorted = data.sort((a, b) => new Date(a.date) - new Date(b.date));
    var c1 = initChart('chart-hotsearch-timeline');
    c1.setOption({
        tooltip: { trigger: 'axis', formatter: p => p[0].axisValue + '<br>' + p.map(s => s.marker + s.seriesName + ': ' + formatNum(s.data)).join('<br>') },
        legend: { bottom: 0, data: ['搜索量'] },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: sorted.map(d => d.date + ' ' + d.keyword.substring(0, 6)), axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { formatter: v => (v / 10000).toFixed(0) + '万' } },
        series: [{
            type: 'bar', data: sorted.map(d => Number(d.search_volume)),
            itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#ff6b9d' }, { offset: 1, color: '#c44dff' }]) },
            barWidth: '60%'
        }]
    });

    const catMap = {};
    data.forEach(d => catMap[d.category] = (catMap[d.category] || 0) + 1);
    var c2 = initChart('chart-hotsearch-category');
    c2.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, type: 'scroll' },
        series: [{
            type: 'pie', radius: ['35%', '65%'], center: ['50%', '42%'],
            data: Object.entries(catMap).map(([k, v]) => ({ value: v, name: k })),
            label: { formatter: '{b}\n{d}%' }
        }]
    });

    const platMap = {};
    data.forEach(d => platMap[d.platform] = (platMap[d.platform] || 0) + 1);
    var c3 = initChart('chart-hotsearch-platform');
    c3.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 10 },
        series: [{
            type: 'pie', radius: '60%', center: ['50%', '45%'],
            data: Object.entries(platMap).map(([k, v]) => ({ value: v, name: k })),
            label: { formatter: '{b}: {c}条 ({d}%)' }
        }]
    });
}

// ===== 评论精选 =====
async function loadComments() {
    const data = await fetchJSON('/api/comments');
    if (!data) return;
    const top = [...data].sort((a, b) => Number(b.likes) - Number(a.likes)).slice(0, 10);
    const container = document.getElementById('top-comments');
    container.innerHTML = top.map(c => {
        const cls = c.sentiment === 'positive' ? 'tag-positive' : c.sentiment === 'negative' ? 'tag-negative' : 'tag-neutral';
        const label = c.sentiment === 'positive' ? '正面' : c.sentiment === 'negative' ? '负面' : '中性';
        return '<div class="comment-item">' +
            '<div class="comment-user">' + escapeHTML(c.username) + ' (' + escapeHTML(c.platform) + ') <span class="' + cls + '">[' + label + ']</span></div>' +
            '<div class="comment-text">' + escapeHTML(c.comment_text) + '</div>' +
            '<div class="comment-meta">点赞: ' + formatNum(c.likes) + ' | 回复: ' + c.replies + ' | ' + escapeHTML(c.timestamp) + '</div>' +
            '</div>';
    }).join('');

    const platSentiment = {};
    data.forEach(c => {
        if (!platSentiment[c.platform]) platSentiment[c.platform] = { positive: 0, neutral: 0, negative: 0 };
        platSentiment[c.platform][c.sentiment]++;
    });
    const platforms = Object.keys(platSentiment);
    var c1 = initChart('chart-comment-sentiment');
    c1.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, data: ['正面', '中性', '负面'] },
        grid: { left: 80, right: 30, bottom: 40, top: 20 },
        xAxis: { type: 'category', data: platforms },
        yAxis: { type: 'value' },
        series: [
            { name: '正面', type: 'bar', stack: 'total', data: platforms.map(p => platSentiment[p].positive), itemStyle: { color: '#52c41a' } },
            { name: '中性', type: 'bar', stack: 'total', data: platforms.map(p => platSentiment[p].neutral), itemStyle: { color: '#faad14' } },
            { name: '负面', type: 'bar', stack: 'total', data: platforms.map(p => platSentiment[p].negative), itemStyle: { color: '#ff4d4f' } }
        ]
    });
}

// ===== 初始化 =====
window.addEventListener('load', async () => {
    await loadOverview();
});
window.addEventListener('resize', () => {
    Object.values(chartInstances).forEach(c => c.resize());
});
