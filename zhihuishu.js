/**
 * @file zhihuishu.js
 * @author perhaps(perhapszql@gmail.com) 
 * @date 2017-11-17
 * @description 智慧树视频自动播放下一集，并以1.5倍速度，无声播放
 */

/**
 * dom 加载完毕的5s后才开始执行脚本
 */
console.log('[智慧树刷课] 插件已注入', location.href)
if (document.readyState === 'complete') {
  setTimeout(() => begin(), 5000)
} else {
  window.addEventListener('load', function () {
    setTimeout(() => begin(), 5000)
  })
}

/**
 * 主程序
 */
async function begin() {
  let list = null // 整个视频播放列表
  let video = null // video播放器
  let count = 0

  // 60s内获取播放列表，若失败，则插件不能使用
  list = getElement('list')
  while (1) {
    if (list.length > 0 || count >= 12) break
    count++
    await wait1s(5)
    list = getElement('list')
  }
  if (list.length > 0 && !isNewUI()) { // 旧版页面：自动从没看过的视频开始播放
    playVideo(list)
  }

  // 60s内获取video元素，若失败，则插件不能使用
  await wait1s(5)
  video = getElement('video')
  count = 0
  let maxTries = isNewUI() ? 3 : 12 // 新版页面若是课件，等15s后去点必学资源里的视频
  while (1) {
    if (video !== null || count >= maxTries) break
    count++
    await wait1s(5)
    video = getElement('video')
  }
  if (video === null && isNewUI()) { // 当前是课件：点击页面底部必学资源里的 mp4 视频
    for (let t = 0; t < 6 && video === null; t++) {
      if (clickResourceVideo()) {
        console.log('当前不是视频，已点击必学资源里的视频...')
        for (let i = 0; i < 15; i++) {
          await wait1s(2)
          video = getElement('video')
          if (video !== null) break
        }
      } else {
        await wait1s(5) // 必学资源可能还没渲染出来，等一等再试
      }
    }
    if (video === null) {
      console.log('当前节没有视频，正在跳到下一节...')
      playVideo(getElement('list'))
    }
  }
  if (video !== null) { // 特殊效果重新播放视频
    await specialEffect(video)
  }

  // 隔10s就检查视频是否播放完毕，是否弹出'测试'对话框
  background()
  console.log('脚本成功运行中...')
}

/**
 * 是否为融合课新版页面（目录项为 li.clearfix.video）
 * @returns {boolean}
 */
function isNewUI() {
  return document.querySelector('li.clearfix.video') !== null
}

/**
 * 自动播放下一集
 * @param {Array} list 视频播放列表
 * @returns {boolean} 是否成功切换
 */
function playVideo(list) {
  // 新版页面：当前项带 activeNode，点它后面的第一个可播放视频（forbidClick 为锁定的章节标题）
  let items = Array.prototype.slice.call(document.querySelectorAll('li.clearfix.video'))
  let current = -1
  for (let i = 0; i < items.length; i++) {
    if ((' ' + items[i].className + ' ').indexOf(' activeNode ') !== -1) {
      current = i
      break
    }
  }
  if (current !== -1) {
    for (let i = current + 1; i < items.length; i++) {
      if ((' ' + items[i].className + ' ').indexOf(' forbidClick ') === -1) {
        items[i].click() // 播放下一集
        return true
      }
    }
    return false
  }

  // 旧版页面：按 watchstate 找没看过的
  for (let i = 0, len = list.length; i < len; i++) {
    let watchstate = list[i].getAttribute('watchstate')
    let id = list[i].getAttribute('id')
    // 视频没被播放过并且不是标题行
    if ((watchstate === '0' || watchstate === '2') && id !== 'video-0') {
      list[i].click() // 播放视频
      return true
    }
  }
  return false
}

/**
 * 上次点击过的必学资源视频文件名，避免同一个视频被重复点击
 */
let lastResourceClicked = ''

/**
 * 让页面底部的“必学资源”进入可视区（卡片是滚动到附近才渲染的）
 */
function scrollToResourcesSection() {
  let items = document.querySelectorAll('.resources-item')
  if (items.length > 0) {
    items[0].scrollIntoView({ block: 'center' })
    return
  }
  let el = document.querySelector('.left-warp')
  let scroller = null
  for (let i = 0; el && i < 12; i++, el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 100) scroller = el
  }
  if (scroller !== null) scroller.scrollTop = scroller.scrollHeight
  else window.scrollTo(0, document.body.scrollHeight)
}

/**
 * 点击页面底部“必学资源”里未完成的 mp4 卡片，打开视频播放器
 * 新版融合课里，当前节的视频往往不在右侧目录里，而在页面底部的必学资源
 * @returns {boolean} 是否找到并点击了视频卡片
 */
function clickResourceVideo() {
  let items = document.querySelectorAll('.resources-item')
  if (items.length === 0) {
    scrollToResourcesSection() // 先滚到底部，让视频卡片渲染出来
    return false
  }
  for (let i = 0; i < items.length; i++) {
    let text = items[i].innerText || ''
    if (!/\.mp4/i.test(text)) continue // 只要视频，不碰 pptx
    if (text.indexOf('已完成') !== -1) continue // 已经看完的不再点
    let name = ''
    let lines = text.split('\n')
    for (let j = 0; j < lines.length; j++) {
      if (/\.mp4/i.test(lines[j])) name = lines[j].trim()
    }
    if (name !== '' && name === lastResourceClicked) continue // 刚点过，正在加载
    lastResourceClicked = name
    let card = items[i].querySelector('.basic-info-video-card-container')
    if (card === null) card = items[i]
    let target = card.querySelector('.video-img-bg') || card.querySelector('.video-wrap') || card
    target.click() // 点卡片本体，点播放小图标无效
    return true
  }
  return false
}

/**
 * 按要求播放视频: 1.5倍速度，无声播放
 * @param {Element} video 视频元素
 * @returns void
 */
async function specialEffect(video) {
  try {
    return new Promise((resolve) => { // 3s后按要求播放视频
      setTimeout(() => {
        if (!isNewUI()) video.currentTime = 2 // 旧版页面：视频重新播放
        video.muted = true // 先静音，否则浏览器会拦截 play()
        video.playbackRate = 1.5 // 1.5倍加速
        if (video.paused && typeof video.play === 'function') video.play().catch(() => {}) // 视频停止的话，继续播放
        resolve()
      }, 3000)
    })
  } catch (error) {
    console.log(error)
  }
}

/**
 * 隔10s就检查视频是否播放完毕，是否弹出'测试'对话框
 * @returns void
 */
function background() {
  let waitUntil = Date.now() + 15000 // 刚切过页面，先给页面渲染时间
  // 每10s检查：保持 1.5 倍速静音；视频播完切下一节；课件页自动打开必学资源视频
  setInterval(() => {
    let now = Date.now()
    let video = getElement('video') // 需要不断的获取video元素

    if (video) {
      // 切换视频后播放器会重置，这里持续保持 1.5 倍速、静音
      if (video.playbackRate !== 1.5) video.playbackRate = 1.5
      if (!video.muted) video.muted = true
      if (video.paused && !video.ended) video.play().catch(() => {})
      if (video.ended && now > waitUntil) {
        waitUntil = now + 20000
        console.log('本集播放完毕，正在播放下一集...')
        if (!playVideo(getElement('list'))) {
          console.log('没有找到下一集，正在刷新页面...')
          setTimeout(() => window.location.reload(), 1000)
        }
      }
      return
    }

    // 新版融合课没有视频时：当前节可能是课件，先试必学资源里的 mp4，没有就跳下一节
    if (!isNewUI() || now < waitUntil) return
    if (clickResourceVideo()) {
      console.log('当前不是视频，已点击必学资源里的视频...')
      waitUntil = now + 30000 // 给视频加载时间，避免重复点击
      return
    }
    console.log('当前节没有视频，正在跳到下一节...')
    waitUntil = now + 20000
    if (!playVideo(getElement('list'))) {
      console.log('没有找到下一集，正在刷新页面...')
      setTimeout(() => window.location.reload(), 1000)
    }
  }, 10000)
  // 每10s检查是否弹出'测试'对话框，并关闭
  setInterval(() => {
    let close = getElement('close') // 对话框的关闭按钮
    let choose = getElement('choose')
    if (choose && close) {
      choose.click()
      close.click()
      console.log('已关闭了测试弹窗')
    }
    if (close && !choose) {
      console.log('答题失败')
    }
  }, 10000)
}

/**
 * 获取指定元素
 * @param {string} ele 指定的元素名称
 * @returns {Element} 返回指定元素
 */
function getElement(ele) {
  switch (ele) {
    case 'list':
      { // 视频列表
        let chapterList = document.getElementById('chapterList')
        if (chapterList !== null) return chapterList.getElementsByTagName('li') // 旧版
        return document.querySelectorAll('li.clearfix.video') // 新版融合课
      }
    case 'video':
      { // 播放器
        let video = document.querySelector('.vjs-tech')
        if (video === null) console.log('网速太慢啦，无法获取video元素，请刷新页面')
        return video
      }
    case 'volumn':
      { // 播放器的声音控件
        let volumn = document.querySelector('.volumeIcon')
        if (volumn === null) console.log('网速太慢啦，无法获取功能控件，请刷新页面')
        return volumn
      }
    case 'speedTab':
      { // 播放器的速度控件
        let speedTab = document.querySelector('.speedTab15')
        return speedTab
      }
    case 'sharpness':
      { // 播放器的清晰度控件
        let sharpness = document.querySelector('.line1bq')
        return sharpness
      }
    case 'close':
      { // '测试'对话框的关闭按钮
        let close = document.querySelector('.popboxes_close')
        // let close = document.querySelector('.popbtn_cancel')
        return close
      }
    case 'choose':
      {
        let chooseInput
        let chooseDiv
        let iframeContent = document.querySelector('#tmDialog_iframe')
        if (iframeContent) {
          chooseDiv = iframeContent.contentWindow.document.querySelector('.answerOption')
          if(chooseDiv) {
            chooseInput = chooseDiv.getElementsByTagName('input')[0]
          }
        }
        return chooseInput
      }
  }
}

/**
 * 延时函数
 * @param {number} sec 延时多少秒
 * @returns {Promise} 异步执行
 */
async function wait1s(sec) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, sec * 1000)
  })
}
