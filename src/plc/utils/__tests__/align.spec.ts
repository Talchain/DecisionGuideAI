import { describe, it, expect } from 'vitest'
import { alignLeft, alignRight, alignCenterX, alignTop, alignBottom, alignCenterY, distributeH, distributeV, type NodeBox } from '../../utils/align'

function sample3(): NodeBox[] {
  return [
    { id: 'a', x: 100, y: 100, w: 120, h: 40 },
    { id: 'b', x: 260, y: 120, w: 120, h: 40 },
    { id: 'c', x: 500, y: 160, w: 120, h: 40 },
  ]
}

describe('plc align utils', () => {
  it('alignLeft sets x to group minX', () => {
    const moves = alignLeft(sample3())
    const xs = moves.map(m => m.to.x)
    expect(xs.every(x => x === 100)).toBe(true)
  })

  it('alignRight sets x to maxX - width', () => {
    const moves = alignRight(sample3())
    const expected = 620 - 120 // maxX of group is 620
    const xs = moves.map(m => m.to.x)
    expect(xs.every(x => x === expected)).toBe(true)
  })

  it('alignCenterX centers all by group center', () => {
    const moves = alignCenterX(sample3())
    // group center is (minX=100, maxX=620) -> 360; each to.x should be 360 - w/2 = 300
    const xs = moves.map(m => m.to.x)
    expect(xs.every(x => x === 300)).toBe(true)
  })

  it('alignTop/Bottom/CenterY adjust y only', () => {
    const nodes = sample3()
    const top = alignTop(nodes).map(m => m.to.y)
    expect(top.every(y => y === 100)).toBe(true)
    const bottom = alignBottom(nodes).map(m => m.to.y)
    expect(bottom.every(y => y === 160)).toBe(true) // maxY=200; 200 - h(40) = 160
    const centery = alignCenterY(nodes).map(m => m.to.y)
    expect(centery.every(y => y === 130)).toBe(true) // group cy=(100..200)=150; 150 - h/2(20) = 130
  })

  it('distributeH spaces nodes evenly between group bounds keeping first at its x', () => {
    const moves = distributeH(sample3())
    const byId = (id: string) => moves.find(m => m.id === id)!.to.x
    // group bounds: minX=100, maxX=620, width=520; total widths=360; gaps=2; space=(520-360)/2=80
    expect(byId('a')).toBe(100)
    expect(byId('b')).toBe(100 + 120 + 80) // 300
    expect(byId('c')).toBe(300 + 120 + 80) // 500
  })

  it('distributeV spaces nodes evenly between group bounds keeping first at its y', () => {
    const nodes: NodeBox[] = [
      { id: 'a', x: 100, y: 100, w: 120, h: 40 },
      { id: 'b', x: 260, y: 120, w: 120, h: 40 },
      { id: 'c', x: 500, y: 160, w: 120, h: 40 },
    ]
    const moves = distributeV(nodes)
    const byIdY = (id: string) => moves.find(m => m.id === id)!.to.y
    // group bounds: minY=100, maxY=200, height=100; total heights=120; gaps=2; space=(100-120)/2=-10 -> overlapping due to heights
    // Our algo keeps first y and steps by h+space
    expect(byIdY('a')).toBe(100)
    expect(byIdY('b')).toBe(100 + 40 - 10) // 130
    expect(byIdY('c')).toBe(130 + 40 - 10) // 160
  })
})
