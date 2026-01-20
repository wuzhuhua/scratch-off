import * as THREE from 'three'
import JSConfetti from 'js-confetti'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import './App.css'

// 所有的奖项定义
const SPECIAL_PRIZES = ["iPhone17", "品牌眼霜", "品牌羽绒服"];
const MONEY_PRIZE = "￥5";
const NO_PRIZE = "NO_PRIZE";

/**
 * 核心逻辑：生成当前局的 9 个槽位数据
 * @param {string} outcome - 本局预定的结果
 * @param {number} luckyNumber - 本局幸运数字
 * @param {number} todayDate - 今天日期
 */
const generateSlots = (outcome, luckyNumber, todayDate) => {
  const slots = [];
  // 辅助函数：生成一个既不是幸运数字也不是今天日期的随机数
  const getSafeRandom = (existing = []) => {
    let n;
    do { n = Math.floor(Math.random() * 100); } while (n === luckyNumber || n === todayDate || existing.includes(n));
    return n;
  };

  const usedNums = [];

  if (SPECIAL_PRIZES.includes(outcome)) {
    /**
     * 场景1：大奖 (iPhone17, 眼霜, 羽绒服)
     * 规则：只包含“幸运数字”，不包含“今天日期”。
     */
    slots.push({ num: luckyNumber, prize: outcome, type: 'lucky' });
    usedNums.push(luckyNumber);
    for (let i = 0; i < 8; i++) {
      const r = getSafeRandom(usedNums);
      slots.push({ num: r, prize: "", type: 'normal' });
      usedNums.push(r);
    }
  } else if (outcome === MONEY_PRIZE) {
    /**
     * 场景2：￥5 奖
     * 规则：同时包含“幸运数字”和“今天日期”。
     */
    slots.push({ num: luckyNumber, prize: MONEY_PRIZE, type: 'lucky' });
    slots.push({ num: todayDate, prize: MONEY_PRIZE, type: 'today' });
    usedNums.push(luckyNumber, todayDate);
    for (let i = 0; i < 7; i++) {
      const r = getSafeRandom(usedNums);
      slots.push({ num: r, prize: "", type: 'normal' });
      usedNums.push(r);
    }
  } else {
    /**
     * 场景3：未中奖
     */
    for (let i = 0; i < 9; i++) {
      const r = getSafeRandom(usedNums);
      slots.push({ num: r, prize: "", type: 'normal' });
      usedNums.push(r);
    }
  }
  return slots.sort(() => Math.random() - 0.5);
};

const toLocalPoint = point => {
  const heightRatio = 512 / 6.656
  const widthRatio = 280 / 3.64
  return { x: point.x * widthRatio + 140, y: point.y * heightRatio + 256 }
}

function App() {
  const container = useRef()
  const lastRAF = useRef(null)
  const isDown = useRef(false)
  const pointer = useRef(new THREE.Vector2())
  const intersectPoints = useRef([])
  
  const [playIndex, setPlayIndex] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [currentOutcome, setCurrentOutcome] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  const todayDate = useMemo(() => new Date().getDate(), [])
  const luckyNumber = useMemo(() => {
    let n; do { n = Math.floor(Math.random() * 100); } while (n === todayDate);
    return n;
  }, [todayDate])

  // 初始化或加载奖池序列
  useEffect(() => {
    let sequence = JSON.parse(localStorage.getItem('scratch_sequence') || '[]');
    let count = parseInt(localStorage.getItem('scratch_play_count') || '0');
    const lastDate = localStorage.getItem('scratch_last_date');
    const todayStr = new Date().toDateString();

    if (lastDate !== todayStr || sequence.length === 0) {
      sequence = [...SPECIAL_PRIZES, MONEY_PRIZE, NO_PRIZE, NO_PRIZE].sort(() => Math.random() - 0.5);
      count = 0;
      localStorage.setItem('scratch_sequence', JSON.stringify(sequence));
      localStorage.setItem('scratch_last_date', todayStr);
      localStorage.setItem('scratch_play_count', '0');
    }

    if (count >= 6) { 
      setIsGameOver(true); 
      setPlayIndex(6); 
    } else { 
      setCurrentOutcome(sequence[count]); 
      setPlayIndex(count); 
    }
  }, []);

  const gameData = useMemo(() => {
    if (!currentOutcome) return [];
    return generateSlots(currentOutcome, luckyNumber, todayDate);
  }, [currentOutcome, luckyNumber, todayDate]);

  const scratchedTypes = useRef(new Set())
  const isTopLuckyScratched = useRef(false)
  const remainingSlots = useRef([])
  const winStateReached = useRef(false)

  const scene = useMemo(() => new THREE.Scene(), [])
  const camera = useMemo(() => new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight * 0.8), 0.1, 1000), [])
  const renderer = useMemo(() => new THREE.WebGLRenderer({ antialias: true }), [])
  const image = useMemo(() => { const img = new Image(280, 512); img.src = 'textures/bg.png'; return img; }, [])
  const canvas0 = useMemo(() => { const c = document.createElement('canvas'); c.width = 280; c.height = 512; return c; }, [])
  const canvas1 = useMemo(() => { const c = document.createElement('canvas'); c.width = 280; c.height = 512; return c; }, [])
  const combineCanvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 280; c.height = 512; return c; }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 }), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(3.64, 6.656), [])
  const jsConfetti = useMemo(() => new JSConfetti(), [])

  const updateCanvas0 = useCallback((showPrizes = false) => {
    if (!gameData.length) return;
    const ctx = canvas0.getContext('2d')
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(image, 0, 0, 280, 512)
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = 'bold 36px sans-serif'
    
    ctx.fillText(todayDate.toString().padStart(2, '0'), 55, 252)
    ctx.fillText(luckyNumber.toString().padStart(2, '0'), 227.5, 252)

    gameData.forEach((item, i) => {
      const x = 70 + (i % 3) * 70, y = 325 + Math.floor(i / 3) * 50
      const isWinnerTarget = (item.type === 'lucky' || (item.type === 'today' && currentOutcome === MONEY_PRIZE))
      ctx.fillStyle = (isWinnerTarget && showPrizes) ? '#ffcc16' : 'white'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText(item.num.toString().padStart(2, '0'), x, y)
      
      if (showPrizes && item.prize) {
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(item.prize, x, y + 18)
      }
    });
  }, [canvas0, image, todayDate, luckyNumber, gameData, currentOutcome])

  const draw = useCallback(() => {
    const ctx1 = canvas1.getContext('2d'), combineCtx = combineCanvas.getContext('2d')
    const len = intersectPoints.current.length
    
    intersectPoints.current.slice(Math.max(0, len - 10), len).forEach(p => {
      const point = toLocalPoint(p)
      ctx1.clearRect(point.x - 12, point.y - 12, 24, 24)
      
      // 1. 检测是否刮到了顶部的幸运数字
      if (Math.sqrt((point.x - 227.5) ** 2 + (point.y - 238) ** 2) <= 28) {
        isTopLuckyScratched.current = true
      }

      // 2. 检测是否刮到了九宫格中的格子
      const index = remainingSlots.current.findIndex(i => {
        const x = 70 + (i % 3) * 70, y = 325 + Math.floor(i / 3) * 50
        return (point.x >= x - 25 && point.x <= x + 25 && point.y >= y - 20 && point.y <= y + 20)
      })

      if (index !== -1) {
        const slotIdx = remainingSlots.current.splice(index, 1)[0]
        const item = gameData[slotIdx]
        if (item.type === 'lucky' || item.type === 'today') {
          scratchedTypes.current.add(item.type)
        }
      }

      // 判定逻辑优化：只要【顶部幸运数字已刮开】且【达成了中奖条件】，就触发特效
      // 将其放在九宫格判定之外，这样无论先刮哪个，只要两个都满足就会开奖
      if (!winStateReached.current && isTopLuckyScratched.current) {
        let win = false
        if (SPECIAL_PRIZES.includes(currentOutcome)) {
          // 场景1：大奖。九宫格中刮出幸运数字格子。
          if (scratchedTypes.current.has('lucky')) win = true
        } else if (currentOutcome === MONEY_PRIZE) {
          // 场景2：￥5 奖。九宫格中同时刮出幸运数字和日期数字。
          if (scratchedTypes.current.has('lucky') && scratchedTypes.current.has('today')) win = true
        }

        if (win) {
          winStateReached.current = true
          updateCanvas0(true) // 更新底层，显现奖品文字
          jsConfetti.addConfetti({ confettiRadius: 4, confettiNumber: 256 })
        }
      }
    })
    
    combineCtx.drawImage(canvas0, 0, 0); combineCtx.drawImage(canvas1, 0, 0)
    material.map = new THREE.CanvasTexture(combineCanvas); material.needsUpdate = true
  }, [canvas0, canvas1, combineCanvas, material, jsConfetti, gameData, updateCanvas0, currentOutcome])

  useEffect(() => {
    if (gameData.length > 0) {
      remainingSlots.current = gameData.map((_, i) => i)
      scratchedTypes.current = new Set(); winStateReached.current = false; isTopLuckyScratched.current = false
      const setup = () => {
        updateCanvas0(false)
        const ctx1 = canvas1.getContext('2d')
        ctx1.fillStyle = '#ccc'
        ctx1.beginPath(); ctx1.arc(227.5, 238, 28, 0, 2 * Math.PI); ctx1.fill()
        ctx1.beginPath(); ctx1.roundRect(20, 285, 240, 160, 4); ctx1.fill()
        const combineCtx = combineCanvas.getContext('2d')
        combineCtx.drawImage(canvas0, 0, 0); combineCtx.drawImage(canvas1, 0, 0)
        material.map = new THREE.CanvasTexture(combineCanvas); material.needsUpdate = true
      }
      if (image.complete) setup(); else image.onload = setup;
    }
  }, [gameData, image, updateCanvas0, canvas1, combineCanvas, canvas0, material])

  useEffect(() => {
    const init = () => {
      camera.aspect = window.innerWidth / (window.innerHeight * 0.8); camera.updateProjectionMatrix()
      renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight * 0.8); renderer.setClearColor(0, 0)
      if (container.current && container.current.children.length === 0) container.current.appendChild(renderer.domElement)
    }
    init(); window.addEventListener('resize', init); return () => window.removeEventListener('resize', init)
  }, [renderer, camera])

  useEffect(() => {
    const card = new THREE.Mesh(geometry, material); card.name = 'card'
    scene.add(card); scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(-0.5, 1.2, 2); scene.add(dl)
    camera.position.z = 5
    const animate = () => {
      lastRAF.current = requestAnimationFrame(animate)
      card.rotation.x += ((Math.PI / 36) * mouse.y - card.rotation.x) * 0.1
      card.rotation.y += ((Math.PI / 16) * mouse.x - card.rotation.y) * 0.04
      const v = new THREE.Vector3(pointer.current.x, pointer.current.y, 0.5).unproject(camera)
      const ray = new THREE.Raycaster(camera.position, v.sub(camera.position).normalize())
      const hits = ray.intersectObject(card)
      if (hits.length > 0 && isDown.current) { intersectPoints.current.push(hits[0].point); draw() }
      renderer.render(scene, camera)
    }
    animate(); return () => { lastRAF.current && cancelAnimationFrame(lastRAF.current); scene.clear() }
  }, [scene, camera, mouse, material, geometry, renderer, draw])

  useEffect(() => {
    const move = e => {
      const x = e.clientX ?? e.touches?.[0]?.clientX, y = e.clientY ?? e.touches?.[0]?.clientY
      const mx = (x / window.innerWidth) * 2 - 1, my = (y / (window.innerHeight * 0.8)) * 2 - 1
      setMouse({ x: mx, y: my }); pointer.current.set(mx, my)
    }
    const down = e => { isDown.current = true; move(e) }
    const up = () => { isDown.current = false; setMouse({ x: 0, y: 0 }) }
    const t = container.current
    t.addEventListener('mousedown', down); window.addEventListener('mouseup', up); t.addEventListener('mousemove', move)
    t.addEventListener('touchstart', down); window.addEventListener('touchend', up); t.addEventListener('touchmove', move)
    return () => {
      t.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); t.removeEventListener('mousemove', move)
      t.removeEventListener('touchstart', down); window.removeEventListener('touchend', up); t.removeEventListener('touchmove', move)
    }
  }, [])

  return (
    <div className='main'>
      <div className='container' ref={container} />
      <div className='menu'>
        {isGameOver ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', marginBottom: '10px' }}>今日 6 次机会已用完</p>
            <button className='button' onClick={() => { localStorage.clear(); window.location.reload(); }}>重新开始 (调试)</button>
          </div>
        ) : (
          <>
            <button 
              className='button' 
              onClick={() => { 
                const newCount = playIndex + 1;
                localStorage.setItem('scratch_play_count', newCount.toString()); 
                if (playIndex === 5){
                  return
                }
                window.location.reload();
              }}
            > 
              {playIndex === 5 ? "最后一张" : `下一张 (第 ${playIndex + 1} / 6 张)`}
            </button>
            {/* <div className='scan'><span onClick={() => setModalVisible(true)}>→ 查看兑奖码 ←</span></div> */}
          </>
        )}
      </div>
      {createPortal(
        <div className='modal' data-visible={`${modalVisible}`} onClick={() => setModalVisible(false)}>
          <p>恭喜获得兑奖码</p><img src='/qrcode.jpg' /><p>点击关闭</p>
        </div>, document.body)}
    </div>
  )
}

export default App
