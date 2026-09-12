import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { ROUTES } from '@/app/routes'

/**
 * The privacy notice, linked from every screen's footer.
 *
 * Written as plain prose rather than a table of legal articles: the people who
 * read it are students and teachers, and a notice nobody finishes is a notice
 * that informs nobody.
 */
export function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-12">
      <h1 className="pt-4 text-headline text-primary">Aviso de privacidade</h1>

      <Card className="flex flex-col gap-4 p-6 text-body text-ink-muted">
        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Quais dados são tratados</h2>
          <p>
            Do professor: nome, e-mail e as turmas, questões, provas e correções que ele cria. Do
            aluno: nome, matrícula, e-mail quando informado pelo professor, e as notas das provas
            que ele fizer.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Para quê</h2>
          <p>
            Para montar provas, imprimir versões, corrigir folhas e devolver a nota ao aluno. Os
            dados não são usados para nenhuma outra finalidade, não são vendidos e não alimentam
            perfil de comportamento.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Quem responde</h2>
          <p>
            A instituição de ensino é a controladora dos dados: é dela a decisão sobre o que é
            tratado e por quê. O Correctio é operador, e trata os dados apenas conforme essa
            decisão.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Base legal</h2>
          <p>
            O tratamento se apoia na execução das atividades de ensino da instituição e no
            legítimo interesse de avaliar e devolver resultados ao aluno, conforme a Lei Geral de
            Proteção de Dados.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Consulta pública de nota</h2>
          <p>
            A página de consulta por QR Code é a única sem login. Ela mostra apenas o que o
            professor liberou, e só para quem tem o código impresso na própria folha. A página
            pede aos buscadores que não a indexem, para que nome e nota não apareçam em resultado
            de busca.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Seus direitos</h2>
          <p>
            Você pode pedir acesso aos seus dados, correção do que estiver errado e anonimização.
            Anonimizar substitui nome e matrícula por marcadores e desfaz o vínculo com a pessoa,
            preservando as estatísticas da turma. Nada é apagado automaticamente por prazo: a
            exclusão acontece quando alguém pede.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-title text-primary">Contato</h2>
          <p>
            Fale com a secretaria da instituição ou com o professor responsável pela turma. Para
            assuntos sobre este sistema, o Grupo 2 da disciplina Projeto e Arquitetura de Software
            da Católica SC responde pelo desenvolvimento.
          </p>
        </section>
      </Card>

      <Link to={ROUTES.signIn} className="text-label text-primary underline">
        Voltar para o início
      </Link>
    </div>
  )
}
