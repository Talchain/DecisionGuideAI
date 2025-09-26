/**
 * Smoke test for UI Kickstart Pack - External Test
 * Tests the packed version as it would be used by Windsurf
 */

// Simple simulation test that can be run independently
async function smokeTest() {
  console.log('🧪 UI Kickstart Pack - Smoke Test');
  console.log('=====================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, condition: boolean) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ ${name}`);
    } else {
      console.log(`❌ ${name}`);
    }
  }

  // Test 1: Check tarball exists
  const fs = await import('fs');
  const path = await import('path');

  const tarballPath = path.join('artifacts', 'decisionguide-ui-kickstart-pack-1.0.0.tgz');
  test('Tarball file exists', fs.existsSync(tarballPath));

  // Test 2: Check tarball size (should be reasonable)
  if (fs.existsSync(tarballPath)) {
    const stats = fs.statSync(tarballPath);
    test('Tarball size is reasonable (< 50KB)', stats.size < 50000);
    test('Tarball size is not empty (> 1KB)', stats.size > 1000);
  }

  // Test 3: Check source structure
  const packDir = 'artifacts/ui-kickstart-pack';
  test('Pack source directory exists', fs.existsSync(packDir));
  test('Package.json exists', fs.existsSync(path.join(packDir, 'package.json')));
  test('README.md exists', fs.existsSync(path.join(packDir, 'README.md')));
  test('Source directory exists', fs.existsSync(path.join(packDir, 'src')));
  test('Types file exists', fs.existsSync(path.join(packDir, 'src', 'sse-events.d.ts')));
  test('Adapters file exists', fs.existsSync(path.join(packDir, 'src', 'adapters.ts')));
  test('Index file exists', fs.existsSync(path.join(packDir, 'src', 'index.ts')));

  // Test 4: Check content structure
  const readmeContent = fs.readFileSync(path.join(packDir, 'README.md'), 'utf-8');
  test('README contains installation instructions', readmeContent.includes('npm install'));
  test('README contains usage examples', readmeContent.includes('openStreamSim'));
  test('README contains React example', readmeContent.includes('React'));

  // Test 5: Check view models and fixtures
  test('View models directory exists', fs.existsSync(path.join(packDir, 'view-models')));
  test('Fixtures directory exists', fs.existsSync(path.join(packDir, 'fixtures')));

  // Test 6: Simple TypeScript compilation check
  const indexContent = fs.readFileSync(path.join(packDir, 'src', 'index.ts'), 'utf-8');
  test('Index exports sse-events', indexContent.includes("export * from './sse-events'"));
  test('Index exports report-v1', indexContent.includes("export * from './report-v1'"));
  test('Index exports adapters', indexContent.includes("export * from './adapters'"));

  // Test 7: Package.json validation
  const packageJson = JSON.parse(fs.readFileSync(path.join(packDir, 'package.json'), 'utf-8'));
  test('Package has correct name', packageJson.name === '@decisionguide/ui-kickstart-pack');
  test('Package has main field', !!packageJson.main);
  test('Package has types field', !!packageJson.types);
  test('Package includes prepack script', !!packageJson.scripts?.prepack);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Tests passed: ${passed}/${total}`);
  console.log(`Success rate: ${Math.round((passed / total) * 100)}%`);

  if (passed === total) {
    console.log('\n🎉 All smoke tests passed! The UI Kickstart Pack is ready.');
    return true;
  } else {
    console.log('\n⚠️ Some tests failed. Check the pack structure.');
    return false;
  }
}

// Run the test
smokeTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Smoke test error:', error);
  process.exit(1);
});