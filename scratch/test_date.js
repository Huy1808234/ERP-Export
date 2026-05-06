
function test() {
    const history = [];
    const now = new Date('2026-05-01');
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      console.log(monthStr);
      history.push(monthStr);
    }
    console.log('Final History Length:', history.length);
}
test();
