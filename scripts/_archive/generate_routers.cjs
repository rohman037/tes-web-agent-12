const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('server.ts');
const startServerFn = sourceFile.getFunction('startServer');

const routesDir = path.join(__dirname, 'src', 'routes');
if (!fs.existsSync(routesDir)) fs.mkdirSync(routesDir, { recursive: true });

const routeGroups = {};

startServerFn.getBody().getStatements().forEach(stmt => {
  if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
    const expr = stmt.getExpression();
    if (expr.getKind() === SyntaxKind.CallExpression) {
      const propAccess = expr.getExpression();
      if (propAccess.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = propAccess.getName();
        if (['get', 'post', 'put', 'delete'].includes(name)) {
          const args = expr.getArguments();
          if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
            const route = args[0].getLiteralValue();
            const prefix = route.split('/')[2]; 
            if (prefix) {
              if (!routeGroups[prefix]) routeGroups[prefix] = [];
              routeGroups[prefix].push(stmt.getText());
              stmt.remove();
            }
          }
        }
      }
    }
  }
});

// We can't simply remove and extract them because of local variable closures!
// We would need to pass every used local variable.
