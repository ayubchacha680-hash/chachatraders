"use strict";(self.webpackChunkmy_trading_bot=self.webpackChunkmy_trading_bot||[]).push([["676"],{79383(e,t,l){l.r(t),l.d(t,{default:()=>V});var a=l(74848),i=l(96540),n=l(7246),s=l(61944),r=l(67774),o=l(58097),d=l(77247),c=l(5375);let m=e=>!Number.isFinite(e.stake)||e.stake<=0?"Stake must be greater than zero.":!Number.isFinite(e.multiplier)||e.multiplier<1?"Multiplier must be at least 1.":null,b=e=>{let t=m(e);return t||(!Number.isFinite(e.take_profit)||e.take_profit<=0?"Take profit must be greater than zero.":!Number.isFinite(e.stop_loss)||e.stop_loss<=0?"Stop loss must be greater than zero.":null)},f=e=>String(e).replace(/[<>&'"]/g,e=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"})[e]),_=e=>`<shadow type="math_number"><field name="NUM">${e}</field></shadow>`,u=(e,t)=>`<block type="variables_get"><field name="VAR" id="${e}">${t}</field></block>`,y=(e,t,l)=>`<block type="variables_set"><field name="VAR" id="${e}">${t}</field><value name="VALUE">${l}</value></block>`,k=function(){for(var e=arguments.length,t=Array(e),l=0;l<e;l++)t[l]=arguments[l];return t.reduceRight((e,t)=>{let l=t.lastIndexOf("</block>");return l<0?t:`${t.slice(0,l)}${e?`<next>${e}</next>`:""}${t.slice(l)}`},"")},p=(e,t)=>`<block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A">${e}</value><value name="B">${t}</value></block>`,g=(e,t)=>`<block type="math_arithmetic"><field name="OP">ADD</field><value name="A">${e}</value><value name="B">${t}</value></block>`,v=e=>`<block type="logic_boolean"><field name="BOOL">${e?"TRUE":"FALSE"}</field></block>`,h=(e,t,l)=>`<block type="logic_compare"><field name="OP">${t}</field><value name="A">${e}</value><value name="B">${l}</value></block>`,T=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:_(0);return`<block type="free_bot_purchase"><field name="PURCHASE_LIST">${e}</field><value name="PREDICTION">${t}</value></block>`},I=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"",l=`<mutation elseif="${Math.max(0,e.length-1)}" else="${+!!t}"></mutation>`,a=e.map((e,t)=>{let{condition:l,statement:a}=e;return`<value name="IF${t}">${l}</value><statement name="DO${t}">${a}</statement>`}).join("");return`<block type="controls_if">${l}${a}${t?`<statement name="ELSE">${t}</statement>`:""}</block>`},x=(e,t,l,a,i)=>`
<block type="trade_definition" id="trade" x="0" y="0"><statement name="TRADE_OPTIONS"><block type="trade_definition_market" id="market" deletable="false" movable="false"><field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">${f(e)}</field><next><block type="trade_definition_tradetype" id="type" deletable="false" movable="false"><field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">${"DIGITDIFF"===l?"digitdiff":"digitover"}</field><next><block type="trade_definition_contracttype" id="contract" deletable="false" movable="false"><field name="TYPE_LIST">${l}</field><next><block type="trade_definition_candleinterval" id="interval" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field></block></next></block></next></block></next></block></statement><statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="options"><mutation has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation><field name="DURATIONTYPE_LIST">t</field><field name="CURRENCY_LIST">${f(t)}</field><value name="DURATION">${_(1)}</value><value name="AMOUNT">${a}</value><value name="PREDICTION">${i}</value></block></statement>`,E=(e,t,l)=>{let a,i;if(!Number.isFinite(e.stake)||e.stake<=0||!Number.isFinite(e.multiplier)||e.multiplier<1)throw Error("Stake must be greater than zero and multiplier must be at least 1.");let n=u("recovery","cycle:recovery pending"),s=u("step","cycle:step"),r=y("step","cycle:step",`<block type="math_modulo"><value name="DIVIDEND">${g(s,_(1))}</value><value name="DIVISOR">${_(l.length)}</value></block>`),o=I(l.map((e,t)=>({condition:h(s,"EQ",_(t)),statement:T(e.contract,"DIGITDIFF"===e.contract?'<block type="last_digit"/>':_(e.prediction))}))),d=I([{condition:h((a=_(2),`<block type="math_modulo"><value name="DIVIDEND"><block type="last_digit"/></value><value name="DIVISOR">${a}</value></block>`),"EQ",_(0)),statement:T("DIGITEVEN")}],T("DIGITODD")),c=I([{condition:n,statement:d}],o),m=k(y("stake","cycle:stake",p(u("stake","cycle:stake"),u("mult","cycle:multiplier"))),I([{condition:n,statement:k(y("recovery","cycle:recovery pending",v(!1)),r)}],y("recovery","cycle:recovery pending",v(!0)))),b=I([{condition:'<block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block>',statement:m}],k(y("stake","cycle:stake",u("initial","cycle:initial")),y("recovery","cycle:recovery pending",v(!1)),r));return`<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true"><variables>
<variable id="stake">cycle:stake</variable><variable id="initial">cycle:initial</variable><variable id="mult">cycle:multiplier</variable><variable id="step">cycle:step</variable><variable id="recovery">cycle:recovery pending</variable>
</variables>${x(e.symbol,e.currency,"DIGITDIFF",u("stake","cycle:stake"),_(0))}
<statement name="INITIALIZATION">${k(y("stake","cycle:stake",_(e.stake)),y("initial","cycle:initial",_(e.stake)),y("mult","cycle:multiplier",_(e.multiplier)),y("step","cycle:step",_(0)),y("recovery","cycle:recovery pending",v(!1)))}</statement></block>
<block type="before_purchase" id="before" x="0" y="560"><statement name="BEFOREPURCHASE_STACK">${c}</statement></block>
<block type="after_purchase" id="after" x="520" y="560"><statement name="AFTERPURCHASE_STACK">${i=b.lastIndexOf("</block>"),`${b.slice(0,i)}<next><block type="trade_again"/></next>${b.slice(i)}`}</statement></block>
<comment id="free-bot-cycle-comment" pinned="false" h="70" w="360">${t}: ${l.map(e=>e.contract.replace("DIGIT","")+(e.prediction??"")).join(" → ")}. A loss triggers exactly one latest-digit Even/Odd recovery trade.</comment></xml>`},A=e=>`<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <variables>
    <variable type="" id="mg_size" islocal="false" iscloud="false">martingale:size</variable>
    <variable type="" id="mg_mult" islocal="false" iscloud="false">martingale:multiplier</variable>
    <variable type="" id="mg_init" islocal="false" iscloud="false">martingale:initialStake</variable>
  </variables>
  <block type="trade_definition" id="td1" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mkt1" deletable="false" movable="false">
        <field name="MARKET_LIST">${e.market}</field>
        <field name="SUBMARKET_LIST">${e.submarket}</field>
        <field name="SYMBOL_LIST">${e.symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="tt1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">callput</field>
            <field name="TRADETYPE_LIST">callput</field>
            <next>
              <block type="trade_definition_contracttype" id="ct1" deletable="false" movable="false">
                <field name="TYPE_LIST">${e.type}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ci1" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rb1" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="re1" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="i1">
        <field name="VAR" id="mg_size">martingale:size</field>
        <value name="VALUE"><shadow type="math_number" id="n1"><field name="NUM">${e.stake}</field></shadow></value>
        <next>
          <block type="variables_set" id="i2">
            <field name="VAR" id="mg_mult">martingale:multiplier</field>
            <value name="VALUE"><shadow type="math_number" id="n2"><field name="NUM">${e.mult}</field></shadow></value>
            <next>
              <block type="variables_set" id="i3">
                <field name="VAR" id="mg_init">martingale:initialStake</field>
                <value name="VALUE"><shadow type="math_number" id="n3"><field name="NUM">${e.stake}</field></shadow></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="to1">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION"><shadow type="math_number" id="d1"><field name="NUM">5</field></shadow></value>
        <value name="AMOUNT">
          <block type="variables_get" id="ga1"><field name="VAR" id="mg_size">martingale:size</field></block>
        </value>
      </block>
    </statement>
    <statement name="AFTER_PURCHASE">
      <block type="bot_result_is" id="w1">
        <field name="RESULT_LIST">win</field>
        <statement name="STATEMENT">
          <block type="variables_set" id="wr1">
            <field name="VAR" id="mg_size">martingale:size</field>
            <value name="VALUE">
              <block type="variables_get" id="wi1"><field name="VAR" id="mg_init">martingale:initialStake</field></block>
            </value>
          </block>
        </statement>
        <next>
          <block type="bot_result_is" id="l1">
            <field name="RESULT_LIST">loss</field>
            <statement name="STATEMENT">
              <block type="variables_set" id="lr1">
                <field name="VAR" id="mg_size">martingale:size</field>
                <value name="VALUE">
                  <block type="math_arithmetic" id="mul1">
                    <field name="OP">MULTIPLY</field>
                    <value name="A"><block type="variables_get" id="gc1"><field name="VAR" id="mg_size">martingale:size</field></block></value>
                    <value name="B"><block type="variables_get" id="gm1"><field name="VAR" id="mg_mult">martingale:multiplier</field></block></value>
                  </block>
                </value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,R=e=>`<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <variables>
    <variable type="" id="mg_size" islocal="false" iscloud="false">martingale:size</variable>
    <variable type="" id="mg_mult" islocal="false" iscloud="false">martingale:multiplier</variable>
    <variable type="" id="mg_init" islocal="false" iscloud="false">martingale:initialStake</variable>
  </variables>
  <block type="trade_definition" id="td1" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mkt1" deletable="false" movable="false">
        <field name="MARKET_LIST">${e.market}</field>
        <field name="SUBMARKET_LIST">${e.submarket}</field>
        <field name="SYMBOL_LIST">${e.symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="tt1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">${e.tradetype}</field>
            <next>
              <block type="trade_definition_contracttype" id="ct1" deletable="false" movable="false">
                <field name="TYPE_LIST">${e.contracttype}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ci1" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rb1" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="re1" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="i1">
        <field name="VAR" id="mg_size">martingale:size</field>
        <value name="VALUE"><shadow type="math_number" id="n1"><field name="NUM">${e.stake}</field></shadow></value>
        <next>
          <block type="variables_set" id="i2">
            <field name="VAR" id="mg_mult">martingale:multiplier</field>
            <value name="VALUE"><shadow type="math_number" id="n2"><field name="NUM">${e.mult}</field></shadow></value>
            <next>
              <block type="variables_set" id="i3">
                <field name="VAR" id="mg_init">martingale:initialStake</field>
                <value name="VALUE"><shadow type="math_number" id="n3"><field name="NUM">${e.stake}</field></shadow></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="to1">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${null!==e.prediction?"true":"false"}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION"><shadow type="math_number" id="d1"><field name="NUM">5</field></shadow></value>
        <value name="AMOUNT">
          <block type="variables_get" id="ga1"><field name="VAR" id="mg_size">martingale:size</field></block>
        </value>
        ${null!==e.prediction?`<value name="PREDICTION"><shadow type="math_number" id="pr1"><field name="NUM">${e.prediction}</field></shadow></value>`:""}
      </block>
    </statement>
    <statement name="AFTER_PURCHASE">
      <block type="bot_result_is" id="w1">
        <field name="RESULT_LIST">win</field>
        <statement name="STATEMENT">
          <block type="variables_set" id="wr1">
            <field name="VAR" id="mg_size">martingale:size</field>
            <value name="VALUE">
              <block type="variables_get" id="wi1"><field name="VAR" id="mg_init">martingale:initialStake</field></block>
            </value>
          </block>
        </statement>
        <next>
          <block type="bot_result_is" id="l1">
            <field name="RESULT_LIST">loss</field>
            <statement name="STATEMENT">
              <block type="variables_set" id="lr1">
                <field name="VAR" id="mg_size">martingale:size</field>
                <value name="VALUE">
                  <block type="math_arithmetic" id="mul1">
                    <field name="OP">MULTIPLY</field>
                    <value name="A"><block type="variables_get" id="gc1"><field name="VAR" id="mg_size">martingale:size</field></block></value>
                    <value name="B"><block type="variables_get" id="gm1"><field name="VAR" id="mg_mult">martingale:multiplier</field></block></value>
                  </block>
                </value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,w=[{id:"rise_r100",name:"Rise Martingale – Vol 100",description:"Buys RISE (CALL) contracts on Volatility 100 Index. Doubles stake on each loss, resets on win. 5-tick duration.",identity:"RISE",category:"Rise / Fall",tag:"Vol 100",winChance:"~50%",getXml:()=>A({symbol:"R_100",market:"synthetic_index",submarket:"random_index",type:"CALL",stake:1,mult:2})},{id:"fall_r100",name:"Fall Martingale – Vol 100",description:"Buys FALL (PUT) contracts on Volatility 100 Index. Doubles stake on each loss, resets on win. 5-tick duration.",identity:"FALL",category:"Rise / Fall",tag:"Vol 100",winChance:"~50%",getXml:()=>A({symbol:"R_100",market:"synthetic_index",submarket:"random_index",type:"PUT",stake:1,mult:2})},{id:"rise_r50",name:"Rise Martingale – Vol 50",description:"Buys RISE contracts on Volatility 50 Index with lower volatility. Martingale \xd72 on loss.",identity:"R50",category:"Rise / Fall",tag:"Vol 50",winChance:"~50%",getXml:()=>A({symbol:"R_50",market:"synthetic_index",submarket:"random_index",type:"CALL",stake:1,mult:2})},{id:"fall_r50",name:"Fall Martingale – Vol 50",description:"Buys FALL contracts on Volatility 50 (1s) Index. Martingale \xd72 on loss.",identity:"1S",category:"Rise / Fall",tag:"Vol 50 (1s)",winChance:"~50%",getXml:()=>A({symbol:"1HZ50V",market:"synthetic_index",submarket:"random_index",type:"PUT",stake:1,mult:2})},{id:"digit_match_r100",name:"Digit Match 5 – Vol 100",description:"Wins when the last digit of the closing price equals 5. Martingale \xd73 on loss. Higher payout per win.",identity:"MATCH",category:"Digits",tag:"Match",winChance:"~10%",getXml:()=>R({symbol:"R_100",market:"synthetic_index",submarket:"random_index",tradetype:"digitmatch",contracttype:"DIGITMATCH",prediction:5,stake:.5,mult:3})},{id:"digit_differ_r100",name:"Digit Differ 5 – Vol 100",description:"Wins when the last digit is NOT 5. High ~90% win rate, lower payout. Martingale \xd71.5 on loss.",identity:"DIFF",category:"Digits",tag:"Differ",winChance:"~90%",getXml:()=>R({symbol:"R_100",market:"synthetic_index",submarket:"random_index",tradetype:"digitdiff",contracttype:"DIGITDIFF",prediction:5,stake:1,mult:2})},{id:"digit_over5_r50",name:"Digit Over 5 – Vol 50",description:"Wins when the last digit is greater than 5 (digits 6, 7, 8, 9). ~40% win chance. Martingale \xd72.",identity:"OVER",category:"Digits",tag:"Over 5",winChance:"~40%",getXml:()=>R({symbol:"R_50",market:"synthetic_index",submarket:"random_index",tradetype:"digitover",contracttype:"DIGITOVER",prediction:5,stake:1,mult:2})},{id:"digit_under5_r50",name:"Digit Under 5 – Vol 50",description:"Wins when the last digit is less than 5 (digits 0, 1, 2, 3, 4). ~50% win chance. Martingale \xd72.",identity:"UNDER",category:"Digits",tag:"Under 5",winChance:"~50%",getXml:()=>R({symbol:"R_50",market:"synthetic_index",submarket:"random_index",tradetype:"digitunder",contracttype:"DIGITUNDER",prediction:5,stake:1,mult:2})},{id:"digit_even_1hz100",name:"Digit Even – Vol 100 (1s)",description:"Wins when the last digit is even (0, 2, 4, 6, 8). ~50% win chance on 1-second ticks. Martingale \xd72.",identity:"EVEN",category:"Digits",tag:"Even",winChance:"~50%",getXml:()=>R({symbol:"1HZ100V",market:"synthetic_index",submarket:"random_index",tradetype:"digitodd",contracttype:"DIGITEVEN",prediction:null,stake:1,mult:2})},{id:"digit_odd_1hz100",name:"Digit Odd – Vol 100 (1s)",description:"Wins when the last digit is odd (1, 3, 5, 7, 9). ~50% win chance on fast 1-second ticks. Martingale \xd72.",identity:"ODD",category:"Digits",tag:"Odd",winChance:"~50%",getXml:()=>R({symbol:"1HZ100V",market:"synthetic_index",submarket:"random_index",tradetype:"digitodd",contracttype:"DIGITODD",prediction:null,stake:1,mult:2})},{id:"chacha_over_cycle",name:"Chacha Over Cycle",description:"Six-step cycle: Differ, Over 1, Over 2, Differ, Under 8, Under 7. A loss is recovered with one parity-matched Even/Odd trade.",identity:"CYCLE",category:"Cycle Bots",tag:"Over 2",winChance:"Signal-based",configurable:"cycle",getXml:e=>E(e,"Chacha Over Cycle",[{contract:"DIGITDIFF"},{contract:"DIGITOVER",prediction:1},{contract:"DIGITOVER",prediction:2},{contract:"DIGITDIFF"},{contract:"DIGITUNDER",prediction:8},{contract:"DIGITUNDER",prediction:7}])},{id:"market_cycle_bot",name:"Market Cycle Bot",description:"Six-step cycle: Differ, Under 7, Under 6, Differ, Over 2, Over 3. A loss is recovered with one parity-matched Even/Odd trade.",identity:"VH",category:"Cycle Bots",tag:"VH cycle",winChance:"Signal-based",configurable:"cycle",getXml:e=>E(e,"Market Cycle Bot",[{contract:"DIGITDIFF"},{contract:"DIGITUNDER",prediction:7},{contract:"DIGITUNDER",prediction:6},{contract:"DIGITDIFF"},{contract:"DIGITOVER",prediction:2},{contract:"DIGITOVER",prediction:3}])},{id:"over_2_killer",name:"Over 2 Killer",description:"Requires 2 or 3 consecutive digits below 3, then enters Digit Over 2 only on the following digit above 2. Optional VH uses simulated losses first.",identity:"KILL",category:"Cycle Bots",tag:"Over 2",winChance:"~70%",configurable:"killer",getXml:e=>(e=>{let t=b(e);if(t||![2,3].includes(e.confirmation)||!Number.isInteger(e.vh_target)||e.vh_enabled&&e.vh_target<1)throw Error(t||"Confirmation must be 2 or 3 and enabled VH target must be at least 1.");let l=u("low","killer:below 3 count"),a=u("signal","killer:qualifying signal"),i=u("virtual","killer:virtual trade open"),n=u("vh","killer:simulated losses"),s=I([{condition:i,statement:k(I([{condition:h('<block type="last_digit"/>',"LTE",_(2)),statement:y("vh","killer:simulated losses",g(n,_(1)))}]),y("virtual","killer:virtual trade open",v(!1)))}]),r=I([{condition:h('<block type="last_digit"/>',"LT",_(3)),statement:k(y("low","killer:below 3 count",g(l,_(1))),y("signal","killer:qualifying signal",v(!1)))}],k(y("signal","killer:qualifying signal",h(l,"GTE",_(e.confirmation))),y("low","killer:below 3 count",_(0)))),o=k(y("vh","killer:simulated losses",_(0)),y("signal","killer:qualifying signal",v(!1)),T("DIGITOVER",_(2))),d=k(y("virtual","killer:virtual trade open",v(!0)),y("signal","killer:qualifying signal",v(!1))),c=I([{condition:a,statement:I([{condition:e.vh_enabled?h(n,"GTE",_(e.vh_target)):v(!0),statement:o}],d)}]),m=I([{condition:'<block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block>',statement:y("stake","killer:stake",p(u("stake","killer:stake"),u("mult","killer:multiplier")))}],y("stake","killer:stake",u("initial","killer:initial"))),f=`<block type="logic_operation"><field name="OP">AND</field><value name="A">${h(u("profit","killer:total profit"),"LT",u("tp","killer:take profit"))}</value><value name="B">${h(u("profit","killer:total profit"),"GT",`<block type="math_single"><field name="OP">NEG</field><value name="NUM">${u("sl","killer:stop loss")}</value></block>`)}</value></block>`,E=k(y("profit","killer:total profit",g(u("profit","killer:total profit"),'<block type="read_details"><field name="DETAIL_INDEX">4</field></block>')),m,I([{condition:f,statement:'<block type="trade_again"/>'}]));return`<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true"><variables>
<variable id="stake">killer:stake</variable><variable id="initial">killer:initial</variable><variable id="mult">killer:multiplier</variable><variable id="profit">killer:total profit</variable><variable id="low">killer:below 3 count</variable><variable id="signal">killer:qualifying signal</variable><variable id="virtual">killer:virtual trade open</variable><variable id="vh">killer:simulated losses</variable><variable id="tp">killer:take profit</variable><variable id="sl">killer:stop loss</variable>
</variables>${x(e.symbol,e.currency,"DIGITOVER",u("stake","killer:stake"),_(2))}
<statement name="INITIALIZATION">${k(y("stake","killer:stake",_(e.stake)),y("initial","killer:initial",_(e.stake)),y("mult","killer:multiplier",_(e.multiplier)),y("tp","killer:take profit",_(e.take_profit)),y("sl","killer:stop loss",_(e.stop_loss)),y("low","killer:below 3 count",_(0)),y("profit","killer:total profit",_(0)),y("vh","killer:simulated losses",_(0)),y("signal","killer:qualifying signal",v(!1)),y("virtual","killer:virtual trade open",v(!1)))}</statement></block>
<block type="tick_analysis" id="killer_ticks" x="0" y="500"><statement name="TICKANALYSIS_STACK">${k(s,r)}</statement></block>
<block type="before_purchase" id="killer_before" x="0" y="760"><statement name="BEFOREPURCHASE_STACK">${c}</statement></block>
<block type="after_purchase" id="killer_after" x="520" y="600"><statement name="AFTERPURCHASE_STACK">${E}</statement></block>
<comment id="free-bot-killer-comment" pinned="false" h="70" w="300">Over 2 Killer: ${e.confirmation} below-3 digits then a digit over 2. VH ${e.vh_enabled?`simulates ${e.vh_target} losses before the next real entry`:"disabled"}; TP/SL gate the real-trade loop.</comment></xml>`})(e)}],S=["All","Rise / Fall","Digits","Cycle Bots"],N=[{symbol:"R_10",label:"Volatility 10 Index"},{symbol:"R_25",label:"Volatility 25 Index"},{symbol:"R_50",label:"Volatility 50 Index"},{symbol:"R_75",label:"Volatility 75 Index"},{symbol:"R_100",label:"Volatility 100 Index"},{symbol:"1HZ10V",label:"Volatility 10 (1s) Index"},{symbol:"1HZ15V",label:"Volatility 15 (1s) Index"},{symbol:"1HZ25V",label:"Volatility 25 (1s) Index"},{symbol:"1HZ30V",label:"Volatility 30 (1s) Index"},{symbol:"1HZ50V",label:"Volatility 50 (1s) Index"},{symbol:"1HZ75V",label:"Volatility 75 (1s) Index"},{symbol:"1HZ90V",label:"Volatility 90 (1s) Index"},{symbol:"1HZ100V",label:"Volatility 100 (1s) Index"}],D={symbol:"R_100",currency:"USD",stake:1,multiplier:2},L={...D,take_profit:10,stop_loss:5,confirmation:3,vh_enabled:!0,vh_target:3},V=(0,n.observer)(()=>{let{client:e,dashboard:t,run_panel:l}=(0,c.Pj)(),[n,f]=(0,i.useState)("All"),[_,u]=(0,i.useState)(null),[y,k]=(0,i.useState)(null),[p,g]=(0,i.useState)(null),[v,h]=(0,i.useState)(N),[T,I]=(0,i.useState)(D),[x,E]=(0,i.useState)(L),A="All"===n?w:w.filter(e=>e.category===n);(0,i.useEffect)(()=>{let e,t=!1,l=0,a=async()=>{var i;let n=null===r.ApiHelpers||void 0===r.ApiHelpers||null==(i=r.ApiHelpers.instance)?void 0:i.active_symbols;if(!n){!t&&l++<20&&(e=window.setTimeout(a,250));return}try{Object.keys(n.processed_symbols||{}).length||await n.retrieveActiveSymbols(!0);let e=n.getAllSymbols().filter(e=>"synthetic_index"===e.market&&"random_index"===e.submarket).map(e=>({symbol:e.symbol,label:e.symbol_display})).sort((e,t)=>e.label.localeCompare(t.label));if(!t&&e.length){h(e);let t=e.some(e=>e.symbol===T.symbol),l=e.some(e=>e.symbol===x.symbol);t||I(t=>({...t,symbol:e[0].symbol})),l||E(t=>({...t,symbol:e[0].symbol}))}}catch(e){t||g(`Unable to refresh markets: ${e.message}`)}};return a(),()=>{t=!0,e&&window.clearTimeout(e)}},[]);let R=async function(e,t,a){let i=arguments.length>3&&void 0!==arguments[3]?arguments[3]:24,n=window.Blockly,s=null==n?void 0:n.derivWorkspace;if(!s||!(null==n?void 0:n.Xml))if(i>0)return await new Promise(e=>window.setTimeout(e,250)),R(e,t,a,i-1);else return k(null),g("Bot Builder workspace did not finish loading. Please try again."),!1;try{let i=n.utils.xml.textToDom(e);i=new o.A().convertStrategy(i,!1);let r=Array.from(i.querySelectorAll("block")).map(e=>e.getAttribute("type")).filter(e=>e&&!n.Blocks[e]);if(r.length)throw Error(`Unsupported block types: ${[...new Set(r)].join(", ")}`);let c=`free-bot-load-${Date.now()}`;try{await (0,d.CJ)(i,c,s)}finally{n.Events.setGroup(!1)}if(s.clearUndo(),s.current_strategy_id=n.utils.idGenerator.genUid(),s.strategy_to_load=n.Xml.domToText(i),!s.getTopBlocks(!1).length)throw Error("The bot loaded without any blocks.");return u(t.id),k(null),a&&window.setTimeout(()=>l.onRunButtonClick(),100),!0}catch(e){return k(null),g(`Failed to load bot: ${e.message??e}`),!1}},V=async function(l){let a,i=arguments.length>1&&void 0!==arguments[1]&&arguments[1];if(i&&!window.confirm(`Load and run “${l.name}”? This can place trades on your currently selected account. Confirm the stake and use a demo account first.`))return;g(null),k(l.id);let n={..."killer"===l.configurable?x:T,currency:e.currency||"USD"},r="killer"===l.configurable?b(x)||([2,3].includes(x.confirmation)?!Number.isInteger(x.vh_target)||x.vh_target<1?"VH target must be a whole number of at least 1.":null:"Confirmation must be 2 or 3 digits."):"cycle"===l.configurable?m(T):null;if(r){k(null),g(r);return}try{a=l.getXml(l.configurable?n:void 0)}catch(e){k(null),g(e.message||"Unable to create this bot with the selected settings.");return}await R(a,l,i)&&t.setActiveTab(s.HL.BOT_BUILDER)};return(0,a.jsxs)("div",{className:"free-bots",children:[(0,a.jsxs)("div",{className:"free-bots__header",children:[(0,a.jsxs)("div",{className:"free-bots__header-text",children:[(0,a.jsx)("div",{className:"free-bots__eyebrow",children:"ALPHATRADERS / BOT LIBRARY"}),(0,a.jsx)("h2",{className:"free-bots__title",children:"Free Strategy Bots"}),(0,a.jsx)("p",{className:"free-bots__subtitle",children:"Ready-made Martingale bots for Digits and Rise/Fall markets. Load a configured strategy into Bot Builder, then choose whether to run it from your workspace."})]}),(0,a.jsxs)("div",{className:"free-bots__warning",children:[(0,a.jsx)("strong",{children:"Risk warning"}),(0,a.jsx)("span",{"aria-hidden":"true",children:" / "}),"Martingale strategies can lead to large losses. Set a loss limit and test on a demo account first."]})]}),(0,a.jsx)("div",{className:"free-bots__filters",children:S.map(e=>(0,a.jsx)("button",{className:`free-bots__filter ${n===e?"free-bots__filter--active":""}`,onClick:()=>f(e),children:e},e))}),p&&(0,a.jsx)("div",{className:"free-bots__error",role:"alert",children:p}),(0,a.jsx)("div",{className:"free-bots__grid",children:A.map(e=>(0,a.jsxs)("article",{className:`free-bots__card free-bots__card--${e.id} ${_===e.id?"free-bots__card--loaded":""} ${y===e.id?"free-bots__card--loading":""}`,children:[(0,a.jsxs)("div",{className:"free-bots__card-top",children:[(0,a.jsxs)("div",{className:"free-bots__identity","aria-hidden":"true",children:[(0,a.jsx)("span",{className:"free-bots__identity-mark",children:e.identity.slice(0,1)}),(0,a.jsx)("span",{className:"free-bots__identity-label",children:e.identity})]}),(0,a.jsxs)("div",{className:"free-bots__tags",children:[(0,a.jsx)("span",{className:"free-bots__tag",children:e.category}),(0,a.jsx)("span",{className:"free-bots__tag free-bots__tag--type",children:e.tag})]})]}),(0,a.jsx)("h3",{className:"free-bots__card-name",children:e.name}),(0,a.jsx)("p",{className:"free-bots__card-desc",children:e.description}),(0,a.jsxs)("div",{className:"free-bots__stats",children:[(0,a.jsxs)("div",{className:"free-bots__stat",children:[(0,a.jsx)("span",{className:"free-bots__stat-label",children:"Win Rate"}),(0,a.jsx)("span",{className:"free-bots__stat-val",children:e.winChance})]}),(0,a.jsxs)("div",{className:"free-bots__stat",children:[(0,a.jsx)("span",{className:"free-bots__stat-label",children:"Strategy"}),(0,a.jsx)("span",{className:"free-bots__stat-val",children:"Martingale \xd72"})]})]}),"cycle"===e.configurable&&(0,a.jsxs)("fieldset",{className:"free-bots__settings",children:[(0,a.jsx)("legend",{children:"Cycle settings"}),(0,a.jsxs)("label",{children:["Symbol",(0,a.jsx)("select",{"aria-label":`${e.name} symbol`,value:T.symbol,onChange:e=>I({...T,symbol:e.target.value}),children:v.map(e=>(0,a.jsx)("option",{value:e.symbol,children:e.label},e.symbol))})]}),["stake","multiplier"].map(t=>(0,a.jsxs)("label",{children:["take_profit"===t?"Take profit":"stop_loss"===t?"Stop loss":t,(0,a.jsx)("input",{"aria-label":`${e.name} ${t.replace("_"," ")}`,min:"0.01",step:"0.01",type:"number",value:T[t],onChange:e=>I({...T,[t]:Number(e.target.value)})})]},t))]}),"killer"===e.configurable&&(0,a.jsxs)("fieldset",{className:"free-bots__settings",children:[(0,a.jsx)("legend",{children:"Over 2 Killer settings"}),(0,a.jsxs)("label",{children:["Symbol",(0,a.jsx)("select",{"aria-label":`${e.name} symbol`,value:x.symbol,onChange:e=>E({...x,symbol:e.target.value}),children:v.map(e=>(0,a.jsx)("option",{value:e.symbol,children:e.label},e.symbol))})]}),["stake","multiplier","take_profit","stop_loss","vh_target"].map(t=>(0,a.jsxs)("label",{children:[t.replace("_"," "),(0,a.jsx)("input",{"aria-label":`${e.name} ${t.replace("_"," ")}`,min:"vh_target"===t?"1":"0.01",step:"vh_target"===t?"1":"0.01",type:"number",value:x[t],onChange:e=>E({...x,[t]:Number(e.target.value)})})]},t)),(0,a.jsxs)("label",{children:["Below-3 confirmation",(0,a.jsxs)("select",{"aria-label":`${e.name} confirmation`,value:x.confirmation,onChange:e=>E({...x,confirmation:Number(e.target.value)}),children:[(0,a.jsx)("option",{value:"2",children:"2 digits"}),(0,a.jsx)("option",{value:"3",children:"3 digits"})]})]}),(0,a.jsxs)("label",{className:"free-bots__checkbox",children:[(0,a.jsx)("input",{"aria-label":`${e.name} enable volatility hunter`,type:"checkbox",checked:x.vh_enabled,onChange:e=>E({...x,vh_enabled:e.target.checked})})," Enable VH simulated-loss filter"]})]}),_===e.id&&(0,a.jsxs)("div",{className:"free-bots__loaded-badge",children:[(0,a.jsx)("span",{"aria-hidden":"true"}),"Loaded into Bot Builder"]}),(0,a.jsxs)("div",{className:"free-bots__card-actions",children:[(0,a.jsxs)("button",{className:"free-bots__btn free-bots__btn--load",onClick:()=>V(e),"aria-label":`Load ${e.name} in Bot Builder`,disabled:y===e.id,children:[(0,a.jsx)("span",{className:"free-bots__btn-indicator","aria-hidden":"true"}),y===e.id?"Loading":"Load"]}),(0,a.jsx)("button",{className:"free-bots__btn free-bots__btn--run",onClick:()=>V(e,!0),"aria-label":`Load and run ${e.name}`,disabled:y===e.id,children:"Load & Run"})]})]},e.id))})]})})}}]);