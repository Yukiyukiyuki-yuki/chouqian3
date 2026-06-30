import { useState, useRef, useCallback, useEffect } from "react";

const MODULES = [
  { id: "palm", icon: "🤚", title: "AI 看手相", desc: "上传手掌照片，AI大师解读掌纹" },
  { id: "face", icon: "🧿", title: "AI 看面相", desc: "上传面部照片，解析五官运势" },
  { id: "lots", icon: "🎋", title: "隔空摇签", desc: "对着摄像头挥手摇签，签筒跟手晃动" },
  { id: "bazi", icon: "📜", title: "八字命理", desc: "输入生辰八字，排盘解读命格五行" },
  { id: "ziwei", icon: "⭐", title: "紫微斗数", desc: "紫微排盘，十二宫位详细解析" },
  { id: "zodiac", icon: "♈", title: "星座运势", desc: "十二星座今日/本周/本月运势预测" },
];
const ZODIAC_SIGNS = [
  {name:"白羊座",symbol:"♈",dates:"3.21-4.19",en:"Aries"},{name:"金牛座",symbol:"♉",dates:"4.20-5.20",en:"Taurus"},
  {name:"双子座",symbol:"♊",dates:"5.21-6.21",en:"Gemini"},{name:"巨蟹座",symbol:"♋",dates:"6.22-7.22",en:"Cancer"},
  {name:"狮子座",symbol:"♌",dates:"7.23-8.22",en:"Leo"},{name:"处女座",symbol:"♍",dates:"8.23-9.22",en:"Virgo"},
  {name:"天秤座",symbol:"♎",dates:"9.23-10.23",en:"Libra"},{name:"天蝎座",symbol:"♏",dates:"10.24-11.22",en:"Scorpio"},
  {name:"射手座",symbol:"♐",dates:"11.23-12.21",en:"Sagittarius"},{name:"摩羯座",symbol:"♑",dates:"12.22-1.19",en:"Capricorn"},
  {name:"水瓶座",symbol:"♒",dates:"1.20-2.18",en:"Aquarius"},{name:"双鱼座",symbol:"♓",dates:"2.19-3.20",en:"Pisces"},
];
const LOT_POEMS = [
  {num:1,level:"上上签",poem:"日出扶桑耀碧空，天开运至事亨通。\n花开富贵逢春景，万事如意步步红。"},
  {num:3,level:"上签",poem:"云开雾散见青天，守得花开自有期。\n贵人暗中来相助，前途光明不须疑。"},
  {num:7,level:"上签",poem:"春来花放满园香，万物复苏百事昌。\n且把心头烦恼去，自然福禄寿延长。"},
  {num:12,level:"中上签",poem:"月到中秋分外明，人逢喜事精神爽。\n虽然目下多波折，终有柳暗花明时。"},
  {num:18,level:"中签",poem:"风摇竹影半窗月，水映山光一镜天。\n进退存亡皆有数，且将冷眼看流年。"},
  {num:23,level:"中签",poem:"暗去明来事渐分，前途须待贵人扶。\n若能守正心不变，自有青云路坦途。"},
  {num:28,level:"中签",poem:"梧桐叶落半秋凉，行路难时且自量。\n莫怨天公多阻碍，须知苦尽甘来方。"},
  {num:33,level:"中下签",poem:"乌云蔽日暂时昏，大雨过后见乾坤。\n眼前虽有千般苦，待到来年换新春。"},
  {num:42,level:"下签",poem:"花落水流春去也，此身飘泊在天涯。\n若问前程何处是，且收心性度年华。"},
  {num:49,level:"下下签",poem:"秋风落叶满山林，独坐寒窗听雨声。\n万事不如且忍耐，莫将急躁误前程。"},
];

async function askClaude(prompt, imageBase64 = null) {
  const content = [];
  if (imageBase64) content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:imageBase64}});
  content.push({type:"text",text:prompt});
  try {
    const res = await fetch("/api/chat",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:[{role:"user",content}]}),
    });
    const data = await res.json();
    if(data.error) return "接口错误："+JSON.stringify(data.error);
    return data.content?.map(c=>c.text||"").join("\n")||"暂时无法解读，请稍后再试。";
  } catch(e){return "网络异常："+e.message;}
}

// ─── Upload ───
function ImageUpload({onUpload,hint}){
  const fileRef=useRef(null);const [preview,setPreview]=useState(null);const [b64,setB64]=useState(null);
  const handleFile=file=>{if(!file)return;const r=new FileReader();r.onload=e=>{setPreview(e.target.result);setB64(e.target.result.split(",")[1]);};r.readAsDataURL(file);};
  return(<div>
    <div className={`upload-zone ${preview?"has-image":""}`}
      onClick={()=>!preview&&fileRef.current?.click()}
      onDrop={e=>{e.preventDefault();const f=e.dataTransfer?.files?.[0];if(f?.type.startsWith("image/"))handleFile(f);}}
      onDragOver={e=>e.preventDefault()}>
      {preview?(<><img src={preview} alt="" className="upload-preview"/>
        <button className="upload-change" onClick={e=>{e.stopPropagation();setPreview(null);setB64(null);}}>🔄 换一张</button></>
      ):(<><span className="upload-icon">📷</span><div className="upload-text"><strong>点击上传</strong> 或拖拽图片到这里<br/>{hint}</div></>)}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handleFile(e.target.files?.[0])}/>
    </div>
    {preview&&<button className="btn-primary" onClick={()=>b64&&onUpload(b64)}>🔮 开始解读</button>}
  </div>);
}

// ════════════════════════════════════════════════
//  核心：隔空摇签 - 真实方向追踪 + 物理模拟
// ════════════════════════════════════════════════

const STICK_COUNT = 20;
const THRESHOLD = 100;

function CameraShakeLots({ onDrawn }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const prevFrameRef = useRef(null);
  const rafRef = useRef(null);
  const energyRef = useRef(0);
  const dirRef = useRef(0);
  const baselineRef = useRef(0);   // 自动校准的环境噪声基线
  const calibFrames = useRef(0);   // 校准帧计数
  const sticksRef = useRef(
    Array.from({length:STICK_COUNT}, () => ({
      angle: 0, velocity: 0,
      damping: 0.82 + Math.random() * 0.08,
      stiffness: 0.15 + Math.random() * 0.1,
    }))
  );

  const [camReady, setCamReady] = useState(false);
  const [camFailed, setCamFailed] = useState(false);
  const [energy, setEnergy] = useState(0);
  const [stickAngles, setStickAngles] = useState(Array(STICK_COUNT).fill(0));
  const [done, setDone] = useState(false);
  const [flyingStick, setFlyingStick] = useState(null);
  const [motionDir, setMotionDir] = useState(0);
  const [rawMotion, setRawMotion] = useState(0); // 实时原始运动量，给用户看
  const [calibrating, setCalibrating] = useState(true);

  const startCam = useCallback(async()=>{
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{facingMode:"user",width:{ideal:320},height:{ideal:240}}
      });
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setCamReady(true);
    }catch{setCamFailed(true);}
  },[]);
  const stopCam = useCallback(()=>{
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;prevFrameRef.current=null;
  },[]);
  useEffect(()=>{startCam();return stopCam;},[startCam,stopCam]);

  // 主循环：运动检测 + 物理模拟
  useEffect(()=>{
    if(!camReady||done)return;
    const video=videoRef.current,canvas=canvasRef.current;
    if(!video||!canvas)return;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    const W=120,H=90; // 更小的分辨率 = 更快
    canvas.width=W;canvas.height=H;
    let running=true;
    const CALIB_FRAMES = 40; // 前40帧用于校准噪声

    const tick=()=>{
      if(!running)return;
      if(video.readyState>=2){
        ctx.drawImage(video,0,0,W,H);
        const frame=ctx.getImageData(0,0,W,H).data;

        if(prevFrameRef.current){
          const prev=prevFrameRef.current;
          let leftDiff=0,rightDiff=0,totalDiff=0;
          const halfW=W/2;

          // 每隔2像素采样（更密集）
          for(let y=0;y<H;y+=2){
            for(let x=0;x<W;x+=2){
              const i=(y*W+x)*4;
              const d=Math.abs(frame[i]-prev[i])
                +Math.abs(frame[i+1]-prev[i+1])
                +Math.abs(frame[i+2]-prev[i+2]);
              totalDiff+=d;
              if(x<halfW) leftDiff+=d;
              else rightDiff+=d;
            }
          }

          // 校准阶段：学习环境噪声水平
          if(calibFrames.current < CALIB_FRAMES){
            calibFrames.current++;
            // 取前40帧的平均 diff 作为基线
            baselineRef.current = baselineRef.current * 0.9 + totalDiff * 0.1;
            if(calibFrames.current >= CALIB_FRAMES) setCalibrating(false);
          } else {
            // 减去基线噪声，得到真实运动量
            const netDiff = Math.max(totalDiff - baselineRef.current * 1.3, 0);
            // 归一化：基线的 2x 即为满格运动
            const scale = Math.max(baselineRef.current * 2, 5000);
            const magnitude = Math.min(netDiff / scale, 1);

            setRawMotion(magnitude);

            // 方向
            const total = leftDiff+rightDiff;
            let direction = 0;
            if(total>100){
              direction = -(rightDiff-leftDiff)/total;
            }
            dirRef.current = dirRef.current*0.6 + direction*0.4;
            setMotionDir(dirRef.current);

            // 能量累积：动就涨，不动就不涨
            if(magnitude > 0.03){
              energyRef.current = Math.min(
                energyRef.current + magnitude * 5, // 高增益
                THRESHOLD
              );
            }
          }
        }
        prevFrameRef.current = new Uint8ClampedArray(frame);
      }

      // 能量衰减（每帧固定微减）
      energyRef.current = Math.max(energyRef.current - 0.12, 0);
      setEnergy(energyRef.current);

      // 物理模拟
      const dir = dirRef.current;
      const mag = rawMotion;
      const force = dir * mag * 35;
      const newAngles = sticksRef.current.map(s=>{
        const spring = -s.stiffness * s.angle;
        const jitter = mag > 0.03 ? (Math.random()-0.5)*mag*8 : 0;
        s.velocity += spring + (force+jitter)*0.3;
        s.velocity *= s.damping;
        s.angle = Math.max(-45, Math.min(45, s.angle + s.velocity));
        return s.angle;
      });
      setStickAngles(newAngles);

      // 出签判定 —— 立即出签，不做延迟动画
      if(energyRef.current >= THRESHOLD){
        running=false; setDone(true);
        stopCam();
        onDrawn(LOT_POEMS[Math.floor(Math.random()*LOT_POEMS.length)]);
        return;
      }
      rafRef.current=requestAnimationFrame(tick);
    };
    rafRef.current=requestAnimationFrame(tick);
    return()=>{running=false;if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[camReady,done,stopCam,onDrawn,rawMotion]);

  if(camFailed) return <MouseShakeLots onDrawn={onDrawn}/>;

  const pct=Math.min((energy/THRESHOLD)*100,100);
  const label = done?"✨ 出签了！"
    :calibrating?"⏳ 正在校准摄像头..."
    :pct<3?"👋 对着摄像头挥动双手！"
    :pct<20?"🔥 检测到动作了！继续摇"
    :pct<50?"⚡ 很好！保持！签筒在晃了"
    :pct<80?"💪 加把劲！快出签了"
    :pct<95?"💫 马上出签...！"
    :"✨ 出签了！";

  return(
    <div>
      <div className="lots-scene">
        <video ref={videoRef} playsInline muted/>
        <canvas ref={canvasRef}/>
        <div className="lots-overlay">
          <div className="lots-hint">{calibrating ? "⏳ 校准中，请稍等..." : "📹 对着摄像头持续挥动双手摇签"}</div>

          {/* 实时运动检测指示器 */}
          {!calibrating && !done && (
            <div style={{
              position:'absolute',top:12,right:12,
              background:'rgba(0,0,0,.6)',borderRadius:8,padding:'6px 10px',
              fontSize:11,color:rawMotion>0.1?'#7fc4a8':'rgba(255,255,255,.4)',
              pointerEvents:'none',fontVariantNumeric:'tabular-nums',
              border:`1px solid ${rawMotion>0.1?'rgba(127,196,168,.4)':'rgba(255,255,255,.1)'}`,
            }}>
              运动量 {(rawMotion*100).toFixed(0)}%
              <div style={{width:60,height:4,background:'rgba(255,255,255,.1)',borderRadius:2,marginTop:3}}>
                <div style={{width:`${rawMotion*100}%`,height:'100%',borderRadius:2,
                  background:rawMotion>0.1?'#7fc4a8':'rgba(255,255,255,.3)',transition:'width .1s'}}/>
              </div>
            </div>
          )}

          {/* 签筒 */}
          <div className="lots-sticks">
            {stickAngles.map((a,i)=>(
              <div key={i} className="ls"
                style={{transform:`rotate(${a}deg)`,transition:'transform 0.05s'}}
              />
            ))}
          </div>

          {/* 运动方向指示 */}
          {rawMotion>0.08 && !done && (
            <div className="motion-arrow" style={{
              transform:`translateX(${motionDir*60}px) scale(${0.5+rawMotion})`,
              opacity: rawMotion*2,
            }}>
              {motionDir<-0.2?"👈":motionDir>0.2?"👉":"👆"}
            </div>
          )}

          <div className="lots-bottom">
            <div className="lots-label">{label}</div>
            <div className="lots-bar-bg">
              <div className={`lots-bar-fill ${pct>=100?"full":""}`} style={{width:`${pct}%`}}/>
            </div>
            <div className="lots-pct">{Math.floor(pct)}%</div>
          </div>
        </div>
      </div>
      {!camReady&&!camFailed&&<div className="camera-hint">正在请求摄像头权限...</div>}
    </div>
  );
}

// ─── Mouse fallback ───
function MouseShakeLots({onDrawn}){
  const zoneRef=useRef(null);
  const lastPos=useRef({x:0,y:0});
  const energyRef=useRef(0);
  const sticksRef=useRef(Array.from({length:STICK_COUNT},()=>({angle:0,velocity:0,damping:0.82+Math.random()*0.08,stiffness:0.15+Math.random()*0.1})));
  const [cursor,setCursor]=useState({x:200,y:160});
  const [energy,setEnergy]=useState(0);
  const [stickAngles,setStickAngles]=useState(Array(STICK_COUNT).fill(0));
  const [done,setDone]=useState(false);
  const [flyingStick,setFlyingStick]=useState(null);

  // decay + physics
  useEffect(()=>{
    if(done)return;
    const iv=setInterval(()=>{
      energyRef.current=Math.max(energyRef.current-0.12,0);
      setEnergy(energyRef.current);
      // settle sticks when no motion
      const newAngles=sticksRef.current.map(s=>{
        const spring=-s.stiffness*s.angle;
        s.velocity+=spring;s.velocity*=s.damping;s.angle+=s.velocity;
        return s.angle;
      });
      setStickAngles(newAngles);
    },33);
    return()=>clearInterval(iv);
  },[done]);

  // keyboard
  useEffect(()=>{
    if(done)return;
    const handler=e=>{
      if(e.code==="Space"){
        e.preventDefault();
        const force=(Math.random()-0.5)*30;
        sticksRef.current.forEach(s=>{s.velocity+=force*0.3+(Math.random()-0.5)*5;});
        energyRef.current=Math.min(energyRef.current+4,THRESHOLD);
        setEnergy(energyRef.current);
        if(energyRef.current>=THRESHOLD){
          setDone(true);
          onDrawn(LOT_POEMS[Math.floor(Math.random()*LOT_POEMS.length)]);
        }
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[done,onDrawn]);

  const onMove=useCallback((x,y)=>{
    if(done)return;
    setCursor({x,y});
    const dx=x-lastPos.current.x;
    const dist=Math.sqrt((x-lastPos.current.x)**2+(y-lastPos.current.y)**2);
    lastPos.current={x,y};
    const motion=Math.min(dist/8,1);
    if(motion>0.02){
      const dir=dx/Math.max(dist,1);
      sticksRef.current.forEach(s=>{s.velocity+=dir*motion*12+(Math.random()-0.5)*motion*4;});
      energyRef.current=Math.min(energyRef.current+motion*5,THRESHOLD);
      setEnergy(energyRef.current);
      const newAngles=sticksRef.current.map(s=>{
        s.velocity*=s.damping;s.angle+=s.velocity;
        s.angle=Math.max(-45,Math.min(45,s.angle));
        return s.angle;
      });
      setStickAngles(newAngles);
      if(energyRef.current>=THRESHOLD){
        setDone(true);
        onDrawn(LOT_POEMS[Math.floor(Math.random()*LOT_POEMS.length)]);
      }
    }
  },[done,onDrawn]);

  const pct=Math.min((energy/THRESHOLD)*100,100);
  const label=done?"✨ 出签了！":pct<5?"👋 快摇！甩动鼠标/按空格":pct<30?"🔥 继续摇！":pct<60?"⚡ 加把劲！":pct<85?"💫 快了！使劲！":"🎋 即将出签...";

  return(<div>
    <div className="lots-scene" ref={zoneRef} style={{cursor:done?"default":"none"}}
      onMouseMove={e=>{const r=zoneRef.current?.getBoundingClientRect();if(r)onMove(e.clientX-r.left,e.clientY-r.top);}}
      onTouchMove={e=>{const t=e.touches[0];const r=zoneRef.current?.getBoundingClientRect();if(r&&t)onMove(t.clientX-r.left,t.clientY-r.top);}}>
      <div className="mouse-zone"><div className="mouse-zone-bg"/>
        {!done&&<div className="mouse-hand" style={{left:cursor.x,top:cursor.y}}>🤚</div>}
      </div>
      <div className="lots-overlay">
        <div className="lots-hint">🖱️ 在此区域疯狂甩动鼠标 / 滑手指 / 狂按空格</div>
        <div className="lots-sticks">
          {stickAngles.map((a,i)=>(
            <div key={i} className="ls"
              style={{transform:`rotate(${a}deg)`,transition:'transform 0.05s'}}/>
          ))}
        </div>
        <div className="lots-bottom">
          <div className="lots-label">{label}</div>
          <div className="lots-bar-bg"><div className={`lots-bar-fill ${pct>=100?"full":""}`} style={{width:`${pct}%`}}/></div>
          <div className="lots-pct">{Math.floor(pct)}%</div>
        </div>
      </div>
    </div>
    <div className="fallback-note">📹 摄像头不可用，已切换到鼠标/触摸模式</div>
  </div>);
}

// ─── Manual lots ───
function ManualLots({onDrawn}){
  const [shaking,setShaking]=useState(false);
  const draw=async()=>{if(shaking)return;setShaking(true);await new Promise(r=>setTimeout(r,1500));setShaking(false);onDrawn(LOT_POEMS[Math.floor(Math.random()*LOT_POEMS.length)]);};
  return(<div>
    <div className="lots-container" onClick={draw}>
      {Array.from({length:18}).map((_,i)=>(<div key={i} className="lot-stick" style={{animationDuration:shaking?".06s":".3s",animationDelay:`${i*.02}s`}}/>))}
    </div>
    <div className="camera-hint">{shaking?"🙏 签筒摇动中...":"👆 点击签筒摇签"}</div>
  </div>);
}

function Loading({text}){return <div className="loading"><div className="loading-spinner"/><p>{text}</p></div>;}
function Result({title,text}){if(!text)return null;return <div className="result-box"><div className="result-title">🔮 {title}</div><div className="result-text">{text}</div></div>;}

// ─── Pages ───
function PalmPage(){
  const [l,sL]=useState(false);const [r,sR]=useState("");
  const h=async b=>{sL(true);sR("");sR(await askClaude(`你是一位精通中国传统手相学的大师。请根据这张手掌照片进行手相解读：\n1.【生命线】长短、深浅、弧度\n2.【智慧线】走向与长度\n3.【感情线】形态与位置\n4.【事业线】有无与走势\n5.【财运线】特征分析\n6.【综合批语】整体运势总结与建议\n请用温暖亲切的语气详细解读。如果图片不清晰请友善提示重新上传。`,b));sL(false);};
  return(<div><div className="page-title">🤚 AI 看手相</div><div className="page-subtitle">上传手掌照片，AI大师解读掌纹密码</div>
    {!l&&!r&&<ImageUpload onUpload={h} hint="支持手机拍照或上传手掌照片（掌心朝上）"/>}
    {l&&<Loading text="正在解析掌纹..."/>}<Result title="手相解读" text={r}/>
    {r&&<button className="btn-secondary" style={{marginTop:16}} onClick={()=>sR("")}>🔄 再看一次</button>}</div>);
}
function FacePage(){
  const [l,sL]=useState(false);const [r,sR]=useState("");
  const h=async b=>{sL(true);sR("");sR(await askClaude(`你是一位精通中国传统面相学的大师。请根据这张面部照片进行面相解读：\n1.【天庭】额头饱满度与纹理\n2.【眉相】眉形、浓淡、长短\n3.【眼相】眼型、神采\n4.【鼻相】山根、鼻梁、鼻翼\n5.【口相与下巴】唇形、地阁\n6.【气色观察】整体面部气色\n7.【综合批语】面相整体评价与人生建议\n请用专业温和的语气解读，不做外貌负面评价。`,b));sL(false);};
  return(<div><div className="page-title">🧿 AI 看面相</div><div className="page-subtitle">上传面部照片，AI大师解析五官运势</div>
    {!l&&!r&&<ImageUpload onUpload={h} hint="支持手机自拍或上传正面免冠照"/>}
    {l&&<Loading text="正在观面识相..."/>}<Result title="面相解读" text={r}/>
    {r&&<button className="btn-secondary" style={{marginTop:16}} onClick={()=>sR("")}>🔄 再看一次</button>}</div>);
}

function LotsPage(){
  const [mode,setMode]=useState("camera");
  const [drawn,setDrawn]=useState(null);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState("");
  const [question,setQuestion]=useState("");
  const [key,setKey]=useState(0);

  const handleDrawn=async lot=>{
    setDrawn(lot);setLoading(true);setResult("");
    setResult(await askClaude(`你是一位灵验的签诗解读大师。求签者抽到：\n第${lot.num}签 - ${lot.level}\n签诗：${lot.poem}\n${question?`求签者的问题：${question}`:"求签者未指定问题，请综合解读。"}\n请详细解签：\n1.【签诗释义】逐句解释\n2.【运势指引】当前运势启示\n3.【事业学业】工作学习指引\n4.【感情姻缘】感情提示\n5.【行动建议】具体建议\n6.【吉凶总评】整体评价\n用通俗、温暖、鼓励的语气。`));
    setLoading(false);
  };

  return(<div>
    <div className="page-title">🎋 隔空摇签</div>
    <div className="page-subtitle">心诚则灵 · 持续挥动双手 · 签筒跟你的手晃动</div>
    {!drawn&&(<>
      <div className="form-group"><label className="form-label">🙏 心中所求（可选）</label>
        <input className="form-input" placeholder="输入你想问的问题..." value={question} onChange={e=>setQuestion(e.target.value)}/></div>
      <div className="mode-tabs">
        <div className={`mode-tab ${mode==="camera"?"active":""}`} onClick={()=>{setMode("camera");setKey(k=>k+1);}}><span>📹</span>隔空摇签</div>
        <div className={`mode-tab ${mode==="click"?"active":""}`} onClick={()=>setMode("click")}><span>🎋</span>点击抽签</div>
      </div>
      {mode==="camera"?<CameraShakeLots key={key} onDrawn={handleDrawn}/>:<ManualLots onDrawn={handleDrawn}/>}
    </>)}
    {drawn&&(<div className="lot-result-card">
      <div className="lot-number">第{drawn.num}签</div>
      <div className={`lot-level ${drawn.level.includes("上")?"good":""}`}>{drawn.level}</div>
      <div className="lot-poem">{drawn.poem}</div>
    </div>)}
    {loading&&<Loading text="大师正在解签..."/>}
    <Result title="解签" text={result}/>
    {drawn&&!loading&&<button className="btn-secondary" style={{marginTop:16}} onClick={()=>{setDrawn(null);setResult("");setKey(k=>k+1);}}>🔄 再求一签</button>}
  </div>);
}

function BaziPage(){
  const [f,sF]=useState({y:"1995",m:"8",d:"15",h:"午时(11-13点)",g:"女"});const [l,sL]=useState(false);const [r,sR]=useState("");
  const hrs=["子时(23-1点)","丑时(1-3点)","寅时(3-5点)","卯时(5-7点)","辰时(7-9点)","巳时(9-11点)","午时(11-13点)","未时(13-15点)","申时(15-17点)","酉时(17-19点)","戌时(19-21点)","亥时(21-23点)"];
  const u=(k,v)=>sF(p=>({...p,[k]:v}));
  const go=async()=>{sL(true);sR("");sR(await askClaude(`你是一位精通八字命理的大师。出生信息：公历${f.y}年${f.m}月${f.d}日，${f.h}，性别${f.g}。\n请完成：1.【八字排盘】四柱 2.【五行分析】 3.【日主分析】 4.【十神分析】 5.【大运流年】 6.【事业财运】 7.【感情婚姻】 8.【健康提醒】 9.【综合批语】\n用专业但通俗的语气。结尾提醒仅供参考。`));sL(false);};
  return(<div><div className="page-title">📜 八字命理</div><div className="page-subtitle">输入生辰，排盘解读命格五行</div>
    <div className="form-row"><div className="form-group"><label className="form-label">出生年份</label><input className="form-input" type="number" value={f.y} onChange={e=>u("y",e.target.value)} min="1940" max="2026"/></div>
      <div className="form-group"><label className="form-label">月份</label><select className="form-select" value={f.m} onChange={e=>u("m",e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}月</option>)}</select></div></div>
    <div className="form-row"><div className="form-group"><label className="form-label">日期</label><select className="form-select" value={f.d} onChange={e=>u("d",e.target.value)}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}日</option>)}</select></div>
      <div className="form-group"><label className="form-label">时辰</label><select className="form-select" value={f.h} onChange={e=>u("h",e.target.value)}>{hrs.map(h=><option key={h} value={h}>{h}</option>)}</select></div></div>
    <div className="form-group"><label className="form-label">性别</label><div className="gender-row">{["男","女"].map(g=><button key={g} className={`gender-btn ${f.g===g?"active":""}`} onClick={()=>u("g",g)}>{g==="男"?"♂ 男":"♀ 女"}</button>)}</div></div>
    <button className="btn-primary" onClick={go} disabled={l}>{l?"排盘中...":"🔮 开始排盘"}</button>
    {l&&<Loading text="正在排八字..."/>}<Result title="八字命理解读" text={r}/></div>);
}
function ZiweiPage(){
  const [f,sF]=useState({y:"1995",m:"8",d:"15",h:"午时(11-13点)",g:"女",c:"solar"});const [l,sL]=useState(false);const [r,sR]=useState("");
  const hrs=["子时(23-1点)","丑时(1-3点)","寅时(3-5点)","卯时(5-7点)","辰时(7-9点)","巳时(9-11点)","午时(11-13点)","未时(13-15点)","申时(15-17点)","酉时(17-19点)","戌时(19-21点)","亥时(21-23点)"];
  const u=(k,v)=>sF(p=>({...p,[k]:v}));
  const go=async()=>{sL(true);sR("");sR(await askClaude(`你是一位精通紫微斗数的命理大师。出生信息：${f.c==="solar"?"公历":"农历"}${f.y}年${f.m}月${f.d}日，${f.h}，性别${f.g}。\n请完成：1.【命盘概述】 2.【主星分析】 3.【十二宫解读】 4.【四化飞星】 5.【大运分析】 6.【格局判断】 7.【综合建议】\n用专业但通俗的语气。结尾提醒仅供参考。`));sL(false);};
  return(<div><div className="page-title">⭐ 紫微斗数</div><div className="page-subtitle">紫微排盘，十二宫位详细解析</div>
    <div className="form-group"><label className="form-label">历法</label><div className="gender-row">{[["solar","公历"],["lunar","农历"]].map(([v,l])=><button key={v} className={`gender-btn ${f.c===v?"active":""}`} onClick={()=>u("c",v)}>{l}</button>)}</div></div>
    <div className="form-row"><div className="form-group"><label className="form-label">出生年份</label><input className="form-input" type="number" value={f.y} onChange={e=>u("y",e.target.value)} min="1940" max="2026"/></div>
      <div className="form-group"><label className="form-label">月份</label><select className="form-select" value={f.m} onChange={e=>u("m",e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}月</option>)}</select></div></div>
    <div className="form-row"><div className="form-group"><label className="form-label">日期</label><select className="form-select" value={f.d} onChange={e=>u("d",e.target.value)}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}日</option>)}</select></div>
      <div className="form-group"><label className="form-label">时辰</label><select className="form-select" value={f.h} onChange={e=>u("h",e.target.value)}>{hrs.map(h=><option key={h} value={h}>{h}</option>)}</select></div></div>
    <div className="form-group"><label className="form-label">性别</label><div className="gender-row">{["男","女"].map(g=><button key={g} className={`gender-btn ${f.g===g?"active":""}`} onClick={()=>u("g",g)}>{g==="男"?"♂ 男":"♀ 女"}</button>)}</div></div>
    <button className="btn-primary" onClick={go} disabled={l}>{l?"排盘中...":"⭐ 紫微排盘"}</button>
    {l&&<Loading text="正在排紫微命盘..."/>}<Result title="紫微斗数解读" text={r}/></div>);
}
function ZodiacPage(){
  const [sel,setSel]=useState(null);const [period,setPeriod]=useState("today");const [l,sL]=useState(false);const [r,sR]=useState("");
  const pl={today:"今日",week:"本周",month:"本月"};
  const go=async()=>{if(!sel)return;sL(true);sR("");sR(await askClaude(`你是一位专业的星座运势分析师。请为${sel.name}（${sel.en}）撰写${pl[period]}运势。今天是${new Date().toLocaleDateString("zh-CN")}。\n请分析：1.【综合运势】★评分1-5星 2.【爱情运势】 3.【事业学业】 4.【财富运势】 5.【健康运势】 6.【幸运提示】 7.【贴心建议】\n用活泼有趣的语气。`));sL(false);};
  return(<div><div className="page-title">♈ 星座运势</div><div className="page-subtitle">选择你的星座，查看运势预测</div>
    <div className="zodiac-grid">{ZODIAC_SIGNS.map(z=>(<div key={z.name} className={`zodiac-card ${sel?.name===z.name?"active":""}`} onClick={()=>{setSel(z);sR("");}}>
      <span className="zodiac-symbol">{z.symbol}</span><div className="zodiac-name">{z.name}</div><div className="zodiac-dates">{z.dates}</div></div>))}</div>
    {sel&&(<><div className="period-tabs">{Object.entries(pl).map(([k,v])=>(<button key={k} className={`period-tab ${period===k?"active":""}`} onClick={()=>{setPeriod(k);sR("");}}>{v}</button>))}</div>
      <button className="btn-primary" onClick={go} disabled={l}>{l?"占星中...":`🔮 查看${sel.name}${pl[period]}运势`}</button></>)}
    {l&&<Loading text="星象解读中..."/>}<Result title={`${sel?.name||""}${pl[period]}运势`} text={r}/></div>);
}

export default function App(){
  const [page,setPage]=useState("home");
  const pages={palm:PalmPage,face:FacePage,lots:LotsPage,bazi:BaziPage,ziwei:ZiweiPage,zodiac:ZodiacPage};
  const P=pages[page];
  return(<div className="app"><div className="content">
    {page==="home"?(<><div className="header"><div className="header-icon">🔮</div><h1>玄 学 大 师</h1><p>AI 赋能 · 六大玄学一站通</p></div>
      <div className="grid">{MODULES.map(m=>(<div key={m.id} className="card" onClick={()=>setPage(m.id)}>
        <span className="card-icon">{m.icon}</span><div className="card-title">{m.title}</div><div className="card-desc">{m.desc}</div></div>))}</div></>
    ):(<div className="sub-page"><button className="back-btn" onClick={()=>setPage("home")}>← 返回首页</button><P/></div>)}
  </div></div>);
}
