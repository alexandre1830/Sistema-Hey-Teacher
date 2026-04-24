/* ==========================================================================
   STORAGE.JS — Camada de dados (Supabase)
   Todas as funções são assíncronas e retornam Promises.
   ========================================================================== */

window.HT = window.HT || {};

HT.storage = (() => {

  const db = HT.supabase;

  /* ====== Utilitário: ID do usuário autenticado ====== */
  async function _uid() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado.');
    return user.id;
  }

  /* ====================================================================
     MAPPERS — converte snake_case (DB) ↔ camelCase (JS)
     ==================================================================== */

  /* --- Alunos --- */
  function _toStudent(r) {
    return {
      id:         r.id,
      name:       r.name,
      age:        r.age,
      email:      r.email       || '',
      phone:      r.phone       || '',
      classId:    r.class_id    || null,
      level:      r.level       || '',
      schedules:  r.schedules   || [],
      monthlyFee: r.monthly_fee,
      payDay:     r.pay_day,
      notes:      r.notes       || '',
      createdAt:  r.created_at,
    };
  }
  function _fromStudent(d) {
    return {
      name:        d.name,
      age:         d.age         || null,
      email:       d.email       || null,
      phone:       d.phone       || null,
      class_id:    d.classId     || null,
      level:       d.level       || null,
      schedules:   d.schedules   || [],
      monthly_fee: d.monthlyFee  ? +d.monthlyFee : null,
      pay_day:     d.payDay      ? +d.payDay      : null,
      notes:       d.notes       || '',
    };
  }

  /* --- Turmas --- */
  function _toClass(r) {
    return {
      id:         r.id,
      name:       r.name,
      level:      r.level     || '',
      schedules:  r.schedules || [],
      studentIds: (r.students || []).map(s => s.id),
      notes:      r.notes     || '',
      createdAt:  r.created_at,
    };
  }
  function _fromClass(d) {
    return {
      name:      d.name,
      level:     d.level     || null,
      schedules: d.schedules || [],
      notes:     d.notes     || '',
    };
  }

  /* --- Frequência --- */
  function _toAttendance(r) {
    return {
      id:            r.id,
      studentId:     r.student_id,
      classId:       r.class_id     || null,
      date:          r.date,
      status:        r.status,
      lessonContent: r.lesson_content || '',
      notes:         r.notes          || '',
      createdAt:     r.created_at,
    };
  }
  function _fromAttendance(d) {
    return {
      student_id:      d.studentId,
      class_id:        d.classId       || null,
      date:            d.date,
      status:          d.status,
      lesson_content:  d.lessonContent || '',
      notes:           d.notes         || '',
    };
  }

  /* --- Pagamentos --- */
  function _toPayment(r) {
    return {
      id:        r.id,
      studentId: r.student_id,
      reference: r.reference,
      amount:    r.amount,
      dueDate:   r.due_date  || null,
      status:    r.status,
      paidDate:  r.paid_date || null,
      method:    r.method    || null,
      notes:     r.notes     || '',
      createdAt: r.created_at,
    };
  }
  function _fromPayment(d) {
    return {
      student_id: d.studentId,
      reference:  d.reference,
      amount:     +d.amount,
      due_date:   d.dueDate   || null,
      status:     d.status,
      paid_date:  d.paidDate  || null,
      method:     d.method    || null,
      notes:      d.notes     || '',
    };
  }

  /* ====================================================================
     ALUNOS
     ==================================================================== */

  async function getStudents() {
    const uid = await _uid();
    const { data, error } = await db.from('students')
      .select('*')
      .eq('user_id', uid)
      .order('name');
    if (error) throw error;
    return data.map(_toStudent);
  }

  async function getStudent(id) {
    const uid = await _uid();
    const { data, error } = await db.from('students')
      .select('*')
      .eq('id', id)
      .eq('user_id', uid)
      .single();
    if (error) return null;
    return _toStudent(data);
  }

  async function saveStudent(data) {
    const uid = await _uid();
    const row = _fromStudent(data);

    if (data.id) {
      const { data: updated, error } = await db.from('students')
        .update(row)
        .eq('id', data.id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return _toStudent(updated);
    } else {
      const { data: inserted, error } = await db.from('students')
        .insert({ ...row, user_id: uid })
        .select()
        .single();
      if (error) throw error;
      return _toStudent(inserted);
    }
  }

  async function deleteStudent(id) {
    const uid = await _uid();
    /* ON DELETE CASCADE no banco remove frequências e pagamentos vinculados */
    const { error } = await db.from('students')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     TURMAS
     ==================================================================== */

  async function getClasses() {
    const uid = await _uid();
    /* JOIN: inclui IDs dos alunos de cada turma via students.class_id */
    const { data, error } = await db.from('classes')
      .select('*, students(id)')
      .eq('user_id', uid)
      .order('name');
    if (error) throw error;
    return data.map(_toClass);
  }

  async function getClass(id) {
    const uid = await _uid();
    const { data, error } = await db.from('classes')
      .select('*, students(id)')
      .eq('id', id)
      .eq('user_id', uid)
      .single();
    if (error) return null;
    return _toClass(data);
  }

  async function saveClass(data) {
    const uid = await _uid();
    const row = _fromClass(data);

    let classId = data.id;

    if (data.id) {
      const { error } = await db.from('classes')
        .update(row)
        .eq('id', data.id)
        .eq('user_id', uid);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await db.from('classes')
        .insert({ ...row, user_id: uid })
        .select()
        .single();
      if (error) throw error;
      classId = inserted.id;
    }

    /* Sincronizar studentIds: atualizar students.class_id */
    if (Array.isArray(data.studentIds)) {
      const newIds = data.studentIds;

      /* Alunos atualmente na turma */
      const { data: current } = await db.from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('user_id', uid);
      const currentIds = (current || []).map(s => s.id);

      const toRemove = currentIds.filter(i => !newIds.includes(i));
      const toAdd    = newIds.filter(i => !currentIds.includes(i));

      if (toRemove.length > 0) {
        await db.from('students').update({ class_id: null })
          .in('id', toRemove).eq('user_id', uid);
      }
      if (toAdd.length > 0) {
        await db.from('students').update({ class_id: classId })
          .in('id', toAdd).eq('user_id', uid);
      }
    }

    return getClass(classId);
  }

  async function deleteClass(id) {
    const uid = await _uid();
    /* Desvincula alunos antes de deletar */
    await db.from('students').update({ class_id: null })
      .eq('class_id', id).eq('user_id', uid);
    const { error } = await db.from('classes')
      .delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     FREQUÊNCIA
     ==================================================================== */

  async function getAttendance() {
    const uid = await _uid();
    const { data, error } = await db.from('attendance')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false });
    if (error) throw error;
    return data.map(_toAttendance);
  }

  async function getStudentAttendance(studentId) {
    const uid = await _uid();
    const { data, error } = await db.from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .eq('user_id', uid)
      .order('date', { ascending: false });
    if (error) throw error;
    return data.map(_toAttendance);
  }

  async function saveAttendance(data) {
    const uid = await _uid();
    const row = _fromAttendance(data);

    if (data.id) {
      const { data: updated, error } = await db.from('attendance')
        .update(row)
        .eq('id', data.id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return _toAttendance(updated);
    } else {
      const { data: inserted, error } = await db.from('attendance')
        .insert({ ...row, user_id: uid })
        .select()
        .single();
      if (error) throw error;
      return _toAttendance(inserted);
    }
  }

  async function deleteAttendance(id) {
    const uid = await _uid();
    const { error } = await db.from('attendance')
      .delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     PAGAMENTOS
     ==================================================================== */

  async function getPayments() {
    const uid = await _uid();
    const { data, error } = await db.from('payments')
      .select('*')
      .eq('user_id', uid)
      .order('reference', { ascending: false });
    if (error) throw error;
    return data.map(_toPayment);
  }

  async function getStudentPayments(studentId) {
    const uid = await _uid();
    const { data, error } = await db.from('payments')
      .select('*')
      .eq('student_id', studentId)
      .eq('user_id', uid)
      .order('reference', { ascending: false });
    if (error) throw error;
    return data.map(_toPayment);
  }

  async function savePayment(data) {
    const uid = await _uid();
    const row = _fromPayment(data);

    if (data.id) {
      const { data: updated, error } = await db.from('payments')
        .update(row)
        .eq('id', data.id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return _toPayment(updated);
    } else {
      const { data: inserted, error } = await db.from('payments')
        .insert({ ...row, user_id: uid })
        .select()
        .single();
      if (error) throw error;
      return _toPayment(inserted);
    }
  }

  async function deletePayment(id) {
    const uid = await _uid();
    const { error } = await db.from('payments')
      .delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     PERFIL
     ==================================================================== */

  async function getProfile() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;

    const { data } = await db.from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      name:    data?.name    || '',
      email:   data?.email   || user.email || '',
      phone:   data?.phone   || '',
      subject: data?.subject || '',
      bio:     data?.bio     || '',
      photo:   data?.photo   || null,
    };
  }

  async function saveProfile(profileData) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error('Não autenticado.');

    const { error } = await db.from('profiles').upsert({
      id:      user.id,
      name:    profileData.name    || null,
      email:   profileData.email   || null,
      phone:   profileData.phone   || null,
      subject: profileData.subject || null,
      bio:     profileData.bio     || null,
      photo:   profileData.photo   !== undefined ? profileData.photo : null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return getProfile();
  }

  /* ====================================================================
     PROGRESSO — Categorias
     ==================================================================== */

  function _toProgressCategory(r) {
    return { id: r.id, name: r.name, position: r.position ?? 0, createdAt: r.created_at };
  }

  async function getProgressCategories() {
    const uid = await _uid();
    const { data, error } = await db.from('progress_categories')
      .select('*').eq('user_id', uid).order('position');
    if (error) throw error;
    return data.map(_toProgressCategory);
  }

  async function saveProgressCategory(d) {
    const uid = await _uid();
    const row = { name: d.name, position: d.position ?? 0 };
    if (d.id) {
      const { data: u, error } = await db.from('progress_categories')
        .update(row).eq('id', d.id).eq('user_id', uid).select().single();
      if (error) throw error;
      return _toProgressCategory(u);
    }
    const { data: ins, error } = await db.from('progress_categories')
      .insert({ ...row, user_id: uid }).select().single();
    if (error) throw error;
    return _toProgressCategory(ins);
  }

  async function deleteProgressCategory(id) {
    const uid = await _uid();
    const { error } = await db.from('progress_categories')
      .delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     PROGRESSO — Conteúdos
     ==================================================================== */

  function _toProgressContent(r) {
    return {
      id: r.id, categoryId: r.category_id,
      title: r.title, description: r.description || '',
      position: r.position ?? 0, createdAt: r.created_at,
    };
  }

  async function getProgressContents() {
    const uid = await _uid();
    const { data, error } = await db.from('progress_contents')
      .select('*').eq('user_id', uid).order('position');
    if (error) throw error;
    return data.map(_toProgressContent);
  }

  async function saveProgressContent(d) {
    const uid = await _uid();
    const row = {
      category_id: d.categoryId, title: d.title,
      description: d.description || null, position: d.position ?? 0,
    };
    if (d.id) {
      const { data: u, error } = await db.from('progress_contents')
        .update(row).eq('id', d.id).eq('user_id', uid).select().single();
      if (error) throw error;
      return _toProgressContent(u);
    }
    const { data: ins, error } = await db.from('progress_contents')
      .insert({ ...row, user_id: uid }).select().single();
    if (error) throw error;
    return _toProgressContent(ins);
  }

  async function deleteProgressContent(id) {
    const uid = await _uid();
    const { error } = await db.from('progress_contents')
      .delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     PROGRESSO — Registros por aluno
     ==================================================================== */

  function _toStudentProgress(r) {
    return {
      id: r.id, studentId: r.student_id, contentId: r.content_id,
      status: r.status, date: r.date, notes: r.notes || '', createdAt: r.created_at,
    };
  }

  async function getStudentProgressRecords(studentId) {
    const uid = await _uid();
    const { data, error } = await db.from('student_progress')
      .select('*').eq('student_id', studentId).eq('user_id', uid)
      .order('date', { ascending: false });
    if (error) throw error;
    return data.map(_toStudentProgress);
  }

  async function getAllStudentProgress() {
    const uid = await _uid();
    const { data, error } = await db.from('student_progress')
      .select('*').eq('user_id', uid).order('date', { ascending: false });
    if (error) throw error;
    return data.map(_toStudentProgress);
  }

  async function saveStudentProgress(d) {
    const uid = await _uid();
    const row = {
      student_id: d.studentId, content_id: d.contentId,
      status: d.status, date: d.date, notes: d.notes || null,
    };
    if (d.id) {
      const { data: u, error } = await db.from('student_progress')
        .update(row).eq('id', d.id).eq('user_id', uid).select().single();
      if (error) throw error;
      return _toStudentProgress(u);
    }
    const { data: ins, error } = await db.from('student_progress')
      .insert({ ...row, user_id: uid }).select().single();
    if (error) throw error;
    return _toStudentProgress(ins);
  }

  async function bulkSaveStudentProgress(records) {
    const uid = await _uid();
    if (!records.length) return;
    const rows = records.map(d => ({
      user_id: uid, student_id: d.studentId, content_id: d.contentId,
      status: d.status, date: d.date, notes: d.notes || null,
    }));
    const { error } = await db.from('student_progress').insert(rows);
    if (error) throw error;
  }

  async function deleteStudentProgress(id) {
    const uid = await _uid();
    const { error } = await db.from('student_progress')
      .delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  }

  /* ====================================================================
     STUBS de compatibilidade (localStorage não é mais usado)
     ==================================================================== */
  function seedData() { /* no-op — dados reais via Supabase */ }
  function clearAll()  { /* no-op */ }

  return {
    getStudents, getStudent, saveStudent, deleteStudent,
    getClasses,  getClass,  saveClass,  deleteClass,
    getAttendance, getStudentAttendance, saveAttendance, deleteAttendance,
    getPayments,   getStudentPayments,   savePayment,   deletePayment,
    getProfile, saveProfile,
    getProgressCategories, saveProgressCategory, deleteProgressCategory,
    getProgressContents,   saveProgressContent,  deleteProgressContent,
    getStudentProgressRecords, getAllStudentProgress,
    saveStudentProgress, bulkSaveStudentProgress, deleteStudentProgress,
    seedData, clearAll,
  };

})();
