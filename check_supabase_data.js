// Скрипт для проверки данных в Supabase через консоль браузера
// Откройте консоль браузера (F12) на странице с приложением и выполните этот код

async function checkSupabaseData() {
  console.log('🔍 Проверка данных в Supabase...\n');
  
  if (!supabaseClient) {
    console.error('❌ Supabase клиент не инициализирован');
    return;
  }

  try {
    // 1. Получаем текущую статистику
    console.log('1️⃣ Получаем данные из asana_stats...');
    const { data: stats, error: statsError } = await supabaseClient
      .from('asana_stats')
      .select('*')
      .gte('week_start_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('week_start_date', { ascending: false })
      .limit(1)
      .single();

    if (statsError) {
      console.error('❌ Ошибка получения статистики:', statsError);
      return;
    }

    console.log('📊 Данные из asana_stats:');
    console.log({
      week_start_date: stats.week_start_date,
      plan: stats.plan,
      done_fact_this_week: stats.done_fact_this_week,
      remaining_to_plan: stats.remaining_to_plan,
      done_qty: stats.done_qty,
      carry_over_from_prev: stats.carry_over_from_prev,
      overtime_qty: stats.overtime_qty,
      to_shoot_qty: stats.to_shoot_qty,
      week_load: stats.week_load,
      updated_at: stats.updated_at
    });

    // 2. Проверяем расчет remaining_to_plan
    console.log('\n2️⃣ Проверяем расчет remaining_to_plan...');
    const calculatedRemaining = Math.max(0, stats.plan - stats.done_fact_this_week);
    const frontendRemaining = Math.max(0, 80 - stats.done_fact_this_week); // План всегда 80 на фронтенде
    
    console.log(`   План в БД: ${stats.plan}`);
    console.log(`   План на фронтенде: 80 (статический)`);
    console.log(`   done_fact_this_week: ${stats.done_fact_this_week}`);
    console.log(`   remaining_to_plan в БД: ${stats.remaining_to_plan}`);
    console.log(`   Рассчитано с планом из БД: ${calculatedRemaining}`);
    console.log(`   Рассчитано с планом 80 (фронтенд): ${frontendRemaining}`);
    
    if (stats.remaining_to_plan !== calculatedRemaining) {
      console.warn(`   ⚠️ НЕСООТВЕТСТВИЕ: remaining_to_plan в БД (${stats.remaining_to_plan}) не равен расчету (${calculatedRemaining})`);
    } else {
      console.log(`   ✅ remaining_to_plan в БД соответствует расчету`);
    }
    
    if (frontendRemaining !== stats.remaining_to_plan) {
      console.warn(`   ⚠️ НЕСООТВЕТСТВИЕ: фронтенд покажет ${frontendRemaining}, а в БД ${stats.remaining_to_plan}`);
      console.warn(`   💡 Это нормально, если план в БД динамический (80-100), а на фронтенде всегда 80`);
    }

    // 3. Проверяем задачи для расчета done_fact_this_week
    console.log('\n3️⃣ Проверяем задачи для расчета done_fact_this_week...');
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('asana_tasks')
      .select('asana_task_gid, task_name, q, completed, completed_at, shot_at, processed_at, week_shot, week_processed')
      .or(`week_processed.eq.${stats.week_start_date},week_shot.eq.${stats.week_start_date}`)
      .eq('completed', true)
      .gt('q', 0);

    if (tasksError) {
      console.error('❌ Ошибка получения задач:', tasksError);
    } else {
      const totalQ = tasks.reduce((sum, task) => sum + (task.q || 0), 0);
      console.log(`   Найдено задач: ${tasks.length}`);
      console.log(`   Сумма q: ${totalQ}`);
      console.log(`   done_fact_this_week в БД: ${stats.done_fact_this_week}`);
      
      if (Math.abs(totalQ - stats.done_fact_this_week) > 0.01) {
        console.warn(`   ⚠️ НЕСООТВЕТСТВИЕ: сумма q задач (${totalQ}) не равна done_fact_this_week (${stats.done_fact_this_week})`);
        console.log('   📋 Детали задач:');
        tasks.forEach((task, i) => {
          console.log(`      ${i + 1}. ${task.task_name}: q=${task.q}, week_processed=${task.week_processed}, week_shot=${task.week_shot}`);
        });
      } else {
        console.log(`   ✅ Сумма q задач соответствует done_fact_this_week`);
      }
    }

    // 4. Итоговый вывод
    console.log('\n📋 ИТОГОВАЯ ДИАГНОСТИКА:');
    console.log(`   План в БД: ${stats.plan}`);
    console.log(`   План на фронтенде: 80`);
    console.log(`   done_fact_this_week: ${stats.done_fact_this_week}`);
    console.log(`   remaining_to_plan в БД: ${stats.remaining_to_plan}`);
    console.log(`   remaining_to_plan на фронтенде (будет показано): ${frontendRemaining}`);
    
    if (frontendRemaining === 0 && stats.done_fact_this_week < 80) {
      console.error(`   ❌ ПРОБЛЕМА: Фронтенд покажет 0, но должно быть ${80 - stats.done_fact_this_week}`);
      console.error(`   💡 Решение: Убедитесь, что код пересчитывает remaining_to_plan на фронтенде`);
    } else if (frontendRemaining > 0) {
      console.log(`   ✅ Фронтенд покажет правильное значение: ${frontendRemaining}`);
    }

    return {
      stats,
      calculatedRemaining,
      frontendRemaining,
      tasks: tasks || []
    };

  } catch (error) {
    console.error('❌ Ошибка при проверке данных:', error);
  }
}

// Запускаем проверку
checkSupabaseData();

