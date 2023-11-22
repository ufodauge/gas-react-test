export function doGet() {
  const template = HtmlService.createTemplateFromFile("index");
  return template.evaluate();
}
