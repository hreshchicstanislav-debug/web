// Скрипт для принудительного обновления данных из Asana за прошлую и текущую недели
// Использование: откройте консоль браузера (F12) на странице с вкладкой "Задачи" и выполните:
// 
// 1. Скопируйте весь этот файл в консоль
// 2. Или выполните: await forceRefreshBothWeeks()

async function forceRefreshBothWeeks() {
  try {
    console.log('🔄 Начинаю принудительное обновление данных из Asana за прошлую и текущую недели...');
    
    if (!supabaseClient) {
      console.error('❌ Supabase клиент не инициализирован');
      return null;
    }

    // ШАГ 1: Обновляем текущую неделю через Edge Function
    console.log('\n📡 ШАГ 1: Вызываю Edge Function fetch-asana-stats для текущей недели...');
    const { data: currentWeekData, error: currentWeekError } = await supabaseClient.functions.invoke('fetch-asana-stats', {
      body: {}
    });

    if (currentWeekError) {
      console.error('❌ Ошибка при вызове Edge Function для текущей недели:', currentWeekError);
      return null;
    }

    if (!currentWeekData || !currentWeekData.success) {
      console.error('❌ Edge Function вернула ошибку для текущей недели:', currentWeekData?.error || 'Unknown error');
      return null;
    }

    console.log('✅ Текущая неделя обновлена успешно');
    console.log('📊 Данные текущей недели:', {
      week: `${currentWeekData.data.week_start_date} - ${currentWeekData.data.week_end_date}`,
      done_qty: currentWeekData.data.done_qty ?? 0,
      done_fact_this_week: currentWeekData.data.done_fact_this_week ?? 0,
      carry_over_from_prev: currentWeekData.data.carry_over_from_prev ?? 0,
      overtime_qty: currentWeekData.data.overtime_qty ?? 0,
      plan: currentWeekData.data.plan ?? 0
    });

    // ШАГ 2: Пересчитываем прошлую неделю через SQL-функцию
    console.log('\n📡 ШАГ 2: Пересчитываю прошлую неделю через SQL-функцию...');
    
    // Вычисляем дату начала прошлой недели
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Понедельник текущей недели
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const prevWeekStart = new Date(currentWeekStart);
    prevWeekStart.setDate(currentWeekStart.getDate() - 7); // Понедельник прошлой недели
    
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log(`📅 Дата начала прошлой недели: ${prevWeekStartStr}`);
    
    // Вызываем SQL-функцию для пересчета прошлой недели
    const { data: prevWeekData, error: prevWeekError } = await supabaseClient.rpc('recalculate_asana_stats_for_week', {
      week_start_date: prevWeekStartStr
    });

    if (prevWeekError) {
      console.warn('⚠️ Ошибка при пересчете прошлой недели через SQL-функцию:', prevWeekError);
      console.log('💡 Попробую альтернативный способ - прямой SQL запрос...');
      
      // Альтернативный способ: вызываем SQL напрямую
      const { data: sqlData, error: sqlError } = await supabaseClient
        .from('asana_stats')
        .select('*')
        .eq('week_start_date', prevWeekStartStr)
        .single();
      
      if (sqlError && sqlError.code !== 'PGRST116') {
        console.error('❌ Ошибка при получении данных прошлой недели:', sqlError);
      } else if (sqlData) {
        console.log('✅ Данные прошлой недели найдены:', {
          week: sqlData.week_start_date,
          done_qty: sqlData.done_qty ?? 0,
          overtime_qty: sqlData.overtime_qty ?? 0,
          plan: sqlData.plan ?? 0
        });
      } else {
        console.warn('⚠️ Данные за прошлую неделю не найдены в БД');
      }
    } else {
      console.log('✅ Прошлая неделя пересчитана успешно');
      if (prevWeekData) {
        console.log('📊 Результат пересчета:', prevWeekData);
      }
    }

    // ШАГ 3: Повторно обновляем текущую неделю, чтобы учесть изменения в прошлой неделе
    console.log('\n📡 ШАГ 3: Повторно обновляю текущую неделю (чтобы учесть изменения в прошлой)...');
    const { data: finalData, error: finalError } = await supabaseClient.functions.invoke('fetch-asana-stats', {
      body: {}
    });

    if (finalError) {
      console.warn('⚠️ Ошибка при повторном обновлении текущей недели:', finalError);
    } else if (finalData && finalData.success) {
      console.log('✅ Финальное обновление текущей недели выполнено');
      console.log('📊 Финальные данные текущей недели:', {
        week: `${finalData.data.week_start_date} - ${finalData.data.week_end_date}`,
        done_qty: finalData.data.done_qty ?? 0,
        done_fact_this_week: finalData.data.done_fact_this_week ?? 0,
        carry_over_from_prev: finalData.data.carry_over_from_prev ?? 0,
        overtime_qty: finalData.data.overtime_qty ?? 0,
        plan: finalData.data.plan ?? 0
      });
    }

    console.log('\n✅ Обновление завершено!');
    console.log('💡 Обновите страницу или вызовите renderTasks() для отображения новых данных');
    
    return {
      currentWeek: currentWeekData?.data,
      finalWeek: finalData?.data
    };
  } catch (error) {
    console.error('❌ Критическая ошибка при обновлении:', error);
    return null;
  }
}

// Делаем функцию доступной глобально
window.forceRefreshBothWeeks = forceRefreshBothWeeks;

console.log('✅ Функция forceRefreshBothWeeks() загружена. Вызовите: await forceRefreshBothWeeks()');

