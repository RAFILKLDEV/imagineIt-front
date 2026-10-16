import assert from 'node:assert/strict';
import test from 'node:test';
import { getApiErrorMessage } from '../src/services/apiError';

test('upload displays the API reason instead of the generic Axios status', () => {
  const error = {isAxiosError:true,response:{data:{error:'Invalid file size',message:'O arquivo ultrapassa o limite permitido.'}}};
  assert.equal(getApiErrorMessage(error,'Falha no envio'),'O arquivo ultrapassa o limite permitido.');
  assert.equal(getApiErrorMessage({isAxiosError:true,response:{data:{error:'Invalid multipart part request'}}},'Falha'),'Invalid multipart part request');
});
test('upload errors stay readable for failed PUTs, disconnected server and non-JSON responses', () => {
  assert.equal(getApiErrorMessage(new Error('Upload falhou: HTTP 403'),'Falha'),'Upload falhou: HTTP 403');
  assert.match(getApiErrorMessage({isAxiosError:true},'Falha no envio.'),/conexao/);
  assert.equal(getApiErrorMessage({isAxiosError:true,response:{data:'<html>erro</html>'}},'Falha no envio.'),'Falha no envio.');
});
